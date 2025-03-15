import { DatabaseSingleton, GoogleToken, NoId } from '../connections/mongo.ts';

export class GoogleTokenService {
    /**
     * Store a Google token for a user
     */
    async storeToken(userId: string, accessToken: string, refreshToken: string, expiryDate: number): Promise<GoogleToken> {
        const db = await DatabaseSingleton.getInstance();
        const tokenCollection = db.getGoogleTokenCollection();

        // Check if token already exists for this user
        const existingToken = await tokenCollection.findOne({ userId });

        if (existingToken) {
            // Update existing token
            await tokenCollection.updateOne(
                { userId },
                {
                    $set: {
                        accessToken,
                        refreshToken,
                        expiryDate,
                        updatedAt: new Date()
                    }
                }
            );

            return {
                id: existingToken._id.toString(),
                userId,
                accessToken,
                refreshToken,
                expiryDate,
                createdAt: existingToken.createdAt,
                updatedAt: new Date()
            };
        } else {
            // Create new token
            const newToken: NoId<GoogleToken> = {
                userId,
                accessToken,
                refreshToken,
                expiryDate,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await tokenCollection.insertOne(newToken);

            return {
                id: result.insertedId.toString(),
                ...newToken
            };
        }
    }

    /**
     * Get stored token for a user
     */
    async getToken(userId: string): Promise<GoogleToken | null> {
        const db = await DatabaseSingleton.getInstance();
        const tokenCollection = db.getGoogleTokenCollection();

        const token = await tokenCollection.findOne({ userId });

        if (!token) {
            return null;
        }

        return {
            id: token._id.toString(),
            userId: token.userId,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiryDate: token.expiryDate,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt
        };
    }

    /**
     * Update the access token and expiry date
     */
    async updateAccessToken(userId: string, accessToken: string, expiryDate: number): Promise<GoogleToken | null> {
        const db = await DatabaseSingleton.getInstance();
        const tokenCollection = db.getGoogleTokenCollection();

        // First check if the token exists
        const existingToken = await tokenCollection.findOne({ userId });
        if (!existingToken) {
            return null;
        }

        // Update the token
        await tokenCollection.updateOne(
            { userId },
            {
                $set: {
                    accessToken,
                    expiryDate,
                    updatedAt: new Date()
                }
            }
        );

        // Get the updated token
        const updatedToken = await tokenCollection.findOne({ userId });
        if (!updatedToken) {
            return null;
        }

        return {
            id: updatedToken._id.toString(),
            userId: updatedToken.userId,
            accessToken: updatedToken.accessToken,
            refreshToken: updatedToken.refreshToken,
            expiryDate: updatedToken.expiryDate,
            createdAt: updatedToken.createdAt,
            updatedAt: updatedToken.updatedAt
        };
    }

    /**
     * Delete a token
     */
    async deleteToken(userId: string): Promise<boolean> {
        const db = await DatabaseSingleton.getInstance();
        const tokenCollection = db.getGoogleTokenCollection();

        const result = await tokenCollection.deleteOne({ userId });

        return result.deletedCount > 0;
    }
}

export default GoogleTokenService;