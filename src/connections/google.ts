import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseSingleton, GoogleToken, MongoDBService, NoId } from './mongo.ts';

const log = (...args: any[]) => {
    console.log("GoogleService: ", ...args);
}
const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
];

export class GoogleService {
    private oauth2Client: OAuth2Client;

    constructor(
        private readonly db: MongoDBService
    ) {
        const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_CREDS || '{}');

        const CLIENT_SECRET = GOOGLE_CREDS.web;

        if (!CLIENT_SECRET) {
            throw new Error("CLIENT_SECRET not defined. Missing GOOGLE_CREDS in environment variables.");
        }

        this.oauth2Client = new OAuth2Client(
            CLIENT_SECRET.client_id,
            CLIENT_SECRET.client_secret,
            // This redirect URI will need to match what we configure in our Next.js app
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google/callback`
        );
    }

    /**
     * Generate the authorization URL for OAuth2 login
     */
    public getAuthUrl(redirectUri?: string): string {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            redirect_uri: redirectUri || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google/callback`,
            prompt: 'consent', // Always ask for consent to ensure we get a refresh token
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
    public async getTokens(code: string): Promise<GoogleToken> {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                throw new Error('No refresh token received. User may have already granted permission without prompt:consent');
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
                            updatedAt: new Date()
                        }
                    }
                );
                return { id: existingToken._id.toString(), ...newToken };
            } else {
                // Insert new token
                const result = await tokenCollection.insertOne(newToken);
                return { id: result.insertedId.toString(), ...newToken };
            }
        } catch (error) {
            log('Error getting tokens:', error);
            throw error;
        }
    }

    /**
     * Get a valid OAuth2 client with fresh tokens if needed
     */
    public async getAuthorizedClient(userId: string): Promise<OAuth2Client> {
        try {
            const db = await DatabaseSingleton.getInstance();
            const tokenCollection = db.getGoogleTokenCollection();
            const token = await tokenCollection.findOne({ userId });

            if (!token) {
                throw new Error(`No token found for user ${userId}`);
            }

            this.oauth2Client.setCredentials({
                access_token: token.accessToken,
                refresh_token: token.refreshToken,
                expiry_date: token.expiryDate
            });

            // Check if token needs refresh
            if (Date.now() >= token.expiryDate) {
                log('Token expired, refreshing...');
                const { credentials } = await this.oauth2Client.refreshAccessToken();
                log('New token: ');

                // Update token in DB
                await tokenCollection.updateOne(
                    { userId },
                    {
                        $set: {
                            accessToken: credentials.access_token || token.accessToken,
                            expiryDate: credentials.expiry_date || token.expiryDate,
                            updatedAt: new Date()
                        }
                    }
                );
            }

            return this.oauth2Client;
        } catch (error) {
            log('Error getting authorized client:', error);
            throw error;
        }
    }

    /**
     * Get all Google Docs for a user
     */
    public async getUserDocs(userId: string) {
        try {
            const auth = await this.getAuthorizedClient(userId);
            const drive = google.drive({ version: 'v3', auth });

            const response = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.document'",
                fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
                orderBy: 'modifiedByMeTime desc',
                pageSize: 100
            });

            return response.data.files || [];
        } catch (error) {
            log('Error getting user docs:', error);
            throw error;
        }
    }

    public async getGoogleDoc(userId: string, documentId: string): Promise<any> {
        try {
            const auth = await this.getAuthorizedClient(userId);
            const docs = google.docs({ version: 'v1', auth });

            const response = await docs.documents.get({
                documentId
            });

            return response.data;
        } catch (error) {
            log('Error getting Google Doc:', error);
            throw error;
        }
    }

    public async createGoogleDoc(userId: string, title: string): Promise<string> {
        const auth = await this.getAuthorizedClient(userId);
        const drive = google.drive({ version: 'v3', auth });

        const response = await drive.files.create({
            requestBody: {
                name: title,
                mimeType: 'application/vnd.google-apps.document'
            }
        });

        return response.data.id || '';
    }

    /**
     * Get document content
     */
    public async getDocContent(userId: string, documentId: string): Promise<string> {
        try {
            const auth = await this.getAuthorizedClient(userId);
            const docs = google.docs({ version: 'v1', auth });

            const response = await docs.documents.get({
                documentId
            });

            // Simple extraction of text content
            return response.data.body?.content
                ?.map(element => element.paragraph?.elements
                    ?.map(el => el.textRun?.content || '')
                    .join('') || '')
                .join('\n') || '';
        } catch (error) {
            log('Error getting doc content:', error);
            throw error;
        }
    }

    // Keep the existing method for backward compatibility
    public async getDocs(pageSize: number = 100) {
        console.log(process.env.GOOGLE_API_KEY);
        const drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_API_KEY });

        // // Get user info from drive API
        // const about = await drive.about.get({
        //     fields: 'user'
        // });

        // console.log('Google Drive User:', about.data.user);

        const driveResponse = await drive.drives.list({
            pageSize: 10,
        });

        console.log(driveResponse);

        try {
            const response = await drive.files.list({
                // q: "mimeType='application/vnd.google-apps.document'",
                q: "'root' in parents",
                pageSize: 10,
                fields: 'files(id, name)'
            });

            console.log(response);

            const docs = response.data.files;

            console.log('List of Google Docs:');

            if (!docs) {
                throw new Error("No docs found");
            }

            console.log(docs);

            docs.forEach(doc => {
                console.log(`- ${doc.name} (ID: ${doc.id})`);
            });
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}