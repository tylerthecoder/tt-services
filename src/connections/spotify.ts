// @ts-nocheck

import SpotifyWebApi from 'spotify-web-api-node';

enum ISongState {
  PLAYING = 'PLAYING',
  NOT_PLAYING = 'NOT_PLAYING',
}

interface ISimpleTrack {
  name: string;
  artistName: string;
  imageUrl: string;
}

interface ISpotifyImage {
  height: number;
  width: number;
  url: string;
}

export interface ICurrentlyPlayingSong extends ISimpleTrack {
  state: ISongState;
}

interface Response<T> {
  body: T;
  headers: Record<string, string>;
  statusCode: number;
}

interface IAccessTokens {
  accessToken: string;
  refreshToken: string;
}

export default class SpotifyService {
  public api: SpotifyWebApi;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SPOTIFY_SECRET_ID');

    if (!clientId || !clientSecret) {
      throw new Error('Client ID or Client Secret not found');
    }

    this.api = new SpotifyWebApi({
      clientId,
      clientSecret,
      redirectUri: 'http://localhost:6006/me/spotify-callback',
    });
  }

  public async auth(tokens: IAccessTokens) {
    this.api.setAccessToken(tokens.accessToken);
    this.api.setRefreshToken(tokens.refreshToken);
  }

  public getAuthUrl() {
    const permissions = [
      'user-read-private',
      'user-read-email',
      'streaming',
      'user-read-birthdate',
      'user-read-playback-state',
      'user-read-recently-played',
      'user-modify-playback-state',
      'playlist-modify-private',
      'playlist-read-private',
      'playlist-modify-public',
      'playlist-read-collaborative',
      'user-library-read',
    ];
    const authUrl = this.api.createAuthorizeURL(permissions, 'tyler_state');
    return authUrl;
  }

  public async authorizeCode(code: string) {
    const data = await this.api.authorizationCodeGrant(code);
    const tokens = {
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
    };
    this.auth(tokens);
    return tokens;
  }

  private onTokenRefresh: ((token: IAccessTokens) => Promise<void>) | null = null;
  public async setOnTokenRefresh(onTokenRefresh: (token: IAccessTokens) => Promise<void>) {
    this.onTokenRefresh = onTokenRefresh;
  }

  public async refreshToken() {
    const tokens = await this.call((api) => api.refreshAccessToken());
    this.api.setAccessToken(tokens.access_token);
    if (tokens.refresh_token) {
      this.api.setRefreshToken(tokens.refresh_token);

      console.log(this.onTokenRefresh);

      this.onTokenRefresh?.({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
    }
  }

  public async call<T>(call: (api: SpotifyWebApi) => Promise<Response<T>>): Promise<T> {
    const makeCall = async () => {
      try {
        const data = await call(this.api);
        return data;
      } catch (e: any) {
        if (e.message.includes('access token')) {
          await this.refreshToken();
          return call(this.api);
        }
        throw e;
      }
    };

    const data = await makeCall();

    if (data.statusCode == 200 || data.statusCode === 201 || data.statusCode === 204) {
      return data.body;
    }

    throw new Error(`Could not make spotify call ${JSON.stringify(data)}`);
  }

  private currentSongCache = new Cache<ICurrentlyPlayingSong>(10000);
  public async getCurrentSong(): Promise<ICurrentlyPlayingSong> {
    if (this.currentSongCache.value) {
      return Promise.resolve(this.currentSongCache.value);
    }

    const simplifyTrack = (track: SpotifyApi.TrackObjectFull): ISimpleTrack => {
      let smallestImage: ISpotifyImage = { height: Infinity, width: Infinity, url: '' };
      for (const image of track.album.images) {
        const height = image.height;
        const width = image.width;
        if (!height || !width) {
          continue;
        }
        if (height < smallestImage.height) {
          smallestImage = {
            height,
            width,
            url: image.url,
          };
        }
      }

      return {
        name: track.name,
        artistName: track.artists[0].name,
        imageUrl: smallestImage.url,
      };
    };

    const currentSong = await this.call((api) => api.getMyCurrentPlaybackState());

    if (!currentSong.item || currentSong.item.type === 'episode') {
      const pastSongs = await this.call((api) => api.getMyRecentlyPlayedTracks());
      const mostRecentTrackSmall = pastSongs.items[0].track;
      const mostRecentTrack = await this.call((api) => api.getTrack(mostRecentTrackSmall.id));
      const simpleTrack = simplifyTrack(mostRecentTrack);
      return {
        state: ISongState.NOT_PLAYING,
        ...simpleTrack,
      };
    }

    return {
      state: currentSong.is_playing ? ISongState.PLAYING : ISongState.NOT_PLAYING,
      ...simplifyTrack(currentSong.item),
    };
  }
}
