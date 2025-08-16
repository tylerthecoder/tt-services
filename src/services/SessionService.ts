import { Collection } from 'mongodb';
import { createHash, randomBytes } from 'crypto';

export interface SessionRecord {
    id: string;
    sessionIdHash: string;
    userId: string;
    userEmail: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
}

export class SessionService {
    constructor(private readonly collection: Collection<Omit<SessionRecord, 'id'>>) { }

    private hashSessionId(sessionId: string): string {
        return createHash('sha256').update(sessionId).digest('hex');
    }

    public generateSessionId(): string {
        return randomBytes(36).toString('base64url');
    }

    public async createSession(params: {
        sessionId?: string;
        userId: string;
        userEmail: string;
        ttlMs?: number;
        userAgent?: string;
        ip?: string;
    }): Promise<{ id: string; sessionId: string; expiresAt: Date }> {
        const now = new Date();
        const ttlMs = params.ttlMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
        const expiresAt = new Date(now.getTime() + ttlMs);
        const sessionId = params.sessionId ?? this.generateSessionId();
        const sessionIdHash = this.hashSessionId(sessionId);

        const toInsert = {
            sessionIdHash,
            userId: params.userId,
            userEmail: params.userEmail,
            createdAt: now,
            lastSeenAt: now,
            expiresAt,
            userAgent: params.userAgent,
            ip: params.ip,
        };

        const result = await this.collection.insertOne(toInsert);
        return { id: result.insertedId.toString(), sessionId, expiresAt };
    }

    public async getSession(sessionId: string): Promise<SessionRecord | null> {
        const sessionIdHash = this.hashSessionId(sessionId);
        const rec = await this.collection.findOne({ sessionIdHash });
        if (!rec) return null;
        const now = new Date();
        if (rec.expiresAt <= now) return null;
        return { id: (rec as any)._id?.toString?.() || '', ...(rec as any) } as SessionRecord;
    }

    public async touchSession(sessionId: string, extendMs?: number): Promise<void> {
        const sessionIdHash = this.hashSessionId(sessionId);
        const update: any = { lastSeenAt: new Date() };
        if (extendMs && extendMs > 0) {
            update.expiresAt = new Date(Date.now() + extendMs);
        }
        await this.collection.updateOne({ sessionIdHash }, { $set: update });
    }

    public async deleteSession(sessionId: string): Promise<void> {
        const sessionIdHash = this.hashSessionId(sessionId);
        await this.collection.deleteOne({ sessionIdHash });
    }
}


