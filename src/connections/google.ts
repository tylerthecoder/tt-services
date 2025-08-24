import { OAuth2Client } from 'google-auth-library';
import { drive_v3 } from '@googleapis/drive';
import { docs_v1 } from '@googleapis/docs';
import { Logger } from 'pino';

import { GoogleToken, MongoDBService, NoId } from './mongo.ts';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

export class GoogleService {
  private oauth2Client: OAuth2Client;

  constructor(
    private readonly db: MongoDBService,
    private readonly logger: Logger,
  ) {
    const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_CREDS || '{}');

    const CLIENT_SECRET = GOOGLE_CREDS.web;

    if (!CLIENT_SECRET) {
      throw new Error('CLIENT_SECRET not defined. Missing GOOGLE_CREDS in environment variables.');
    }

    this.oauth2Client = new OAuth2Client(CLIENT_SECRET.client_id, CLIENT_SECRET.client_secret);
  }

  /**
   * Generate the authorization URL for OAuth2 login
   */
  public getAuthUrl(redirectUri: string, state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      redirect_uri: redirectUri,
      prompt: 'consent', // Always ask for consent to ensure we get a refresh token
      state: state,
    });
  }

  public async getUserInfo(userId: string) {
    const auth = await this.getAuthorizedClient(userId);
    const authToken = await auth.getAccessToken();
    if (!authToken.token) {
      throw new Error('No access token found');
    }
    const user = await auth.getTokenInfo(authToken.token);
    return user;
  }

  /**
   * Exchange the authorization code for tokens
   */
  public async getTokens(code: string, redirectUri: string): Promise<GoogleToken> {
    try {
      const { tokens } = await this.oauth2Client.getToken({
        code,
        redirect_uri: redirectUri,
      });

      if (!tokens.refresh_token) {
        throw new Error(
          'No refresh token received. User may have already granted permission without prompt:consent',
        );
      }

      console.log('Token from code: ', tokens);

      const tokenInfo = await this.oauth2Client.getTokenInfo(tokens.access_token!);
      const userId = tokenInfo.email || '';
      console.log('tokenInfo', tokenInfo);

      // Create new token for storage
      const newToken: NoId<GoogleToken> = {
        userId: userId,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiryDate: tokens.expiry_date || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      const tokenCollection = this.db.getGoogleTokenCollection();

      // Check if we already have a token for this user
      const existingToken = await tokenCollection.findOne({ userId });

      if (existingToken) {
        // Update existing token
        await tokenCollection.updateOne(
          { userId },
          {
            $set: {
              accessToken: newToken.accessToken,
              refreshToken: newToken.refreshToken,
              expiryDate: newToken.expiryDate,
              updatedAt: new Date(),
            },
          },
        );
        return { id: existingToken._id.toString(), ...newToken };
      } else {
        // Insert new token
        const result = await tokenCollection.insertOne(newToken);
        return { id: result.insertedId.toString(), ...newToken };
      }
    } catch (error) {
      this.logger.error(error, 'Error getting tokens');
      throw error;
    }
  }

  /**
   * Get a valid OAuth2 client with fresh tokens if needed
   */
  public async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
    try {
      const tokenCollection = this.db.getGoogleTokenCollection();
      const token = await tokenCollection.findOne({ userId });

      if (!token) {
        throw new Error(`No token found for user ${userId}`);
      }

      this.oauth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expiry_date: token.expiryDate,
      });

      // Check if token needs refresh
      if (Date.now() >= token.expiryDate) {
        this.logger.info('Token expired, refreshing...');
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        // Update token in DB
        await tokenCollection.updateOne(
          { userId },
          {
            $set: {
              accessToken: credentials.access_token || token.accessToken,
              expiryDate: credentials.expiry_date || token.expiryDate,
              updatedAt: new Date(),
            },
          },
        );
      }

      return this.oauth2Client;
    } catch (error) {
      this.logger.error(error, 'Error getting authorized client');
      throw error;
    }
  }

  private async getDriveClient(userId: string) {
    const auth = await this.getAuthorizedClient(userId);
    return new drive_v3.Drive({ auth });
  }

  private async getDocsClient(userId: string) {
    const auth = await this.getAuthorizedClient(userId);
    return new docs_v1.Docs({ auth });
  }

  /**
   * Get all Google Docs for a user
   */
  public async getUserDocs(userId: string) {
    try {
      const drive = await this.getDriveClient(userId);

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.document'",
        fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
        orderBy: 'modifiedByMeTime desc',
        pageSize: 100,
      });

      return response.data.files || [];
    } catch (error) {
      this.logger.error(error, 'Error getting user docs');
      throw error;
    }
  }

  /**
   * Get a single Drive file's metadata by id
   */
  public async getDriveFileMetadata(
    userId: string,
    fileId: string,
  ): Promise<drive_v3.Schema$File> {
    try {
      const drive = await this.getDriveClient(userId);

      const response = await drive.files.get({
        fileId,
        fields: 'id, name, webViewLink, createdTime, modifiedTime',
      });

      return response.data;
    } catch (error) {
      this.logger.error(error, 'Error getting Drive file metadata');
      throw error;
    }
  }

  public async getGoogleDoc(userId: string, documentId: string): Promise<any> {
    try {
      const docs = await this.getDocsClient(userId);

      const response = await docs.documents.get({
        documentId,
      });

      return response.data;
    } catch (error) {
      this.logger.error(error, 'Error getting Google Doc');
      throw error;
    }
  }

  public async createGoogleDoc(userId: string, title: string): Promise<string> {
    this.logger.info({ userId, title }, 'Creating Google Doc');
    const drive = await this.getDriveClient(userId);

    const response = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
      },
    });

    return response.data.id || '';
  }

  public async updateGoogleDocContent(
    userId: string,
    documentId: string,
    requests: any[],
  ): Promise<void> {
    this.logger.info({ userId, documentId }, 'Updating Google Doc content');
    const docs = await this.getDocsClient(userId);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests,
      },
    });
  }

  public async createGoogleDocWithContent(
    userId: string,
    title: string,
    content: any[],
  ): Promise<string> {
    this.logger.info({ userId, title }, 'Creating Google Doc with content');

    // First create the document
    const documentId = await this.createGoogleDoc(userId, title);

    // Then add content
    if (content && content.length > 0) {
      const requests = content.map((element, index) => ({
        insertText: {
          location: { index: 1 + index }, // Start after title
          text: this.extractTextFromElement(element),
        },
      }));

      await this.updateGoogleDocContent(userId, documentId, requests);
    }

    return documentId;
  }

  public async addTabToGoogleDoc(
    userId: string,
    documentId: string,
    content: any[],
    tabName?: string,
  ): Promise<void> {
    this.logger.info({ userId, documentId, tabName }, 'Adding tab to Google Doc');
    const docs = await this.getDocsClient(userId);

    // Create a new tab (actually append content with a separator)
    const separator = tabName ? `\n\n--- ${tabName} ---\n\n` : '\n\n--- New Section ---\n\n';

    // Get current document to find end position
    const doc = await docs.documents.get({ documentId });
    const endIndex =
      doc.data.body?.content?.reduce((max, element) => {
        const elementEndIndex = element.endIndex || 0;
        return Math.max(max, elementEndIndex);
      }, 0) || 1;

    const requests = [
      {
        insertText: {
          location: { index: endIndex - 1 },
          text: separator,
        },
      },
      ...content.map((element) => ({
        insertText: {
          location: { index: endIndex - 1 },
          text: this.extractTextFromElement(element),
        },
      })),
    ];

    await this.updateGoogleDocContent(userId, documentId, requests);
  }

  private extractTextFromElement(element: any): string {
    if (element.paragraph?.elements) {
      return element.paragraph.elements.map((e: any) => e.textRun?.content || '').join('') + '\n';
    }
    return '';
  }

  /**
   * Get document content
   */
  public async getDocContent(userId: string, documentId: string): Promise<string> {
    try {
      const docs = await this.getDocsClient(userId);

      const response = await docs.documents.get({
        documentId,
      });

      // Simple extraction of text content
      return (
        response.data.body?.content
          ?.map(
            (element) =>
              element.paragraph?.elements?.map((el) => el.textRun?.content || '').join('') || '',
          )
          .join('\n') || ''
      );
    } catch (error) {
      this.logger.error(error, 'Error getting doc content');
      throw error;
    }
  }

  public async getDocs(userId: string, pageSize: number = 100) {
    const drive = await this.getDriveClient(userId);

    const driveResponse = await drive.drives.list({
      pageSize: 10,
    });

    try {
      const response = await drive.files.list({
        // q: "mimeType='application/vnd.google-apps.document'",
        q: "'root' in parents",
        pageSize: 10,
        fields: 'files(id, name)',
      });

      const docs = response.data.files;

      if (!docs) {
        throw new Error('No docs found');
      }

      docs.forEach((doc) => {
        console.log(`- ${doc.name} (ID: ${doc.id})`);
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
