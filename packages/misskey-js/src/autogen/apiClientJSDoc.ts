import type { SwitchCaseResponseType } from '../api.js';
import type { Endpoints } from '../api.types.js';

declare module '../api.js' {
  export interface APIClient {
    /**
     * No description provided.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes* / **Permission**: *write:admin:abuse-report:notification-recipient*
     */
    request<E extends 'admin/abuse-report/notification-recipient/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes* / **Permission**: *write:admin:abuse-report:notification-recipient*
     */
    request<E extends 'admin/abuse-report/notification-recipient/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes* / **Permission**: *read:admin:abuse-report:notification-recipient*
     */
    request<E extends 'admin/abuse-report/notification-recipient/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes* / **Permission**: *read:admin:abuse-report:notification-recipient*
     */
    request<E extends 'admin/abuse-report/notification-recipient/show', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes* / **Permission**: *write:admin:abuse-report:notification-recipient*
     */
    request<E extends 'admin/abuse-report/notification-recipient/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:abuse-user-reports*
     */
    request<E extends 'admin/abuse-user-reports', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'admin/accounts/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:account*
     */
    request<E extends 'admin/accounts/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:account*
     */
    request<E extends 'admin/accounts/find-by-email', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:ad*
     */
    request<E extends 'admin/ad/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:ad*
     */
    request<E extends 'admin/ad/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:ad*
     */
    request<E extends 'admin/ad/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:ad*
     */
    request<E extends 'admin/ad/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:announcements*
     */
    request<E extends 'admin/announcements/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:announcements*
     */
    request<E extends 'admin/announcements/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:announcements*
     */
    request<E extends 'admin/announcements/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:announcements*
     */
    request<E extends 'admin/announcements/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:avatar-decorations*
     */
    request<E extends 'admin/avatar-decorations/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:avatar-decorations*
     */
    request<E extends 'admin/avatar-decorations/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:avatar-decorations*
     */
    request<E extends 'admin/avatar-decorations/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:avatar-decorations*
     */
    request<E extends 'admin/avatar-decorations/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:meta*
     */
    request<E extends 'admin/captcha/current', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:meta*
     */
    request<E extends 'admin/captcha/save', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:delete-account*
     */
    request<E extends 'admin/delete-account', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:delete-all-files-of-a-user*
     */
    request<E extends 'admin/delete-all-files-of-a-user', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:disliked-emojis*
     */
    request<E extends 'admin/disliked-emojis/add', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:disliked-emojis*
     */
    request<E extends 'admin/disliked-emojis/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:disliked-emojis*
     */
    request<E extends 'admin/disliked-emojis/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:drive*
     */
    request<E extends 'admin/drive/clean-remote-files', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:drive*
     */
    request<E extends 'admin/drive/cleanup', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:drive*
     */
    request<E extends 'admin/drive/files', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:drive*
     */
    request<E extends 'admin/drive/show-file', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/add', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/add-aliases-bulk', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/copy', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/delete-bulk', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes*
     */
    request<E extends 'admin/emoji/import-zip', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:emoji*
     */
    request<E extends 'admin/emoji/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:emoji*
     */
    request<E extends 'admin/emoji/list-remote', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/remove-aliases-bulk', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/set-aliases-bulk', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/set-category-bulk', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/set-license-bulk', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:emoji*
     */
    request<E extends 'admin/emoji/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:federation*
     */
    request<E extends 'admin/federation/delete-all-files', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:federation*
     */
    request<E extends 'admin/federation/refresh-remote-instance-metadata', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:federation*
     */
    request<E extends 'admin/federation/remove-all-following', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:federation*
     */
    request<E extends 'admin/federation/update-instance', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:resolve-abuse-user-report*
     */
    request<E extends 'admin/forward-abuse-user-report', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:index-stats*
     */
    request<E extends 'admin/get-index-stats', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:table-stats*
     */
    request<E extends 'admin/get-table-stats', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:user-ips*
     */
    request<E extends 'admin/get-user-ips', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:invite-codes*
     */
    request<E extends 'admin/invite/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:invite-codes*
     */
    request<E extends 'admin/invite/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:meta*
     */
    request<E extends 'admin/meta', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:admin:promo*
     */
    request<E extends 'admin/…26492 tokens truncated…  request<E extends 'pages/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'ping', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'pinned-users', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'promo/read', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:mutes*
     */
    request<E extends 'renote-mute/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:mutes*
     */
    request<E extends 'renote-mute/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:mutes*
     */
    request<E extends 'renote-mute/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Request a users password to be reset.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'request-reset-password', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Only available when running with <code>NODE_ENV=testing</code>. Reset the database and flush Redis.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'reset-db', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Complete the password reset that was previously requested.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'reset-password', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'retention', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'reversi/cancel-match', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'reversi/games', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:account*
     */
    request<E extends 'reversi/invitations', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'reversi/match', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'reversi/show-game', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'reversi/surrender', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'reversi/verify', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:account*
     */
    request<E extends 'roles/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:account*
     */
    request<E extends 'roles/notes', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'roles/show', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'roles/users', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'server-info', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'stats', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Register to receive push notifications.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes*
     */
    request<E extends 'sw/register', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Check push notification registration exists.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes*
     */
    request<E extends 'sw/show-registration', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Unregister from receiving push notifications.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'sw/unregister', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Update push notification registration.
     * 
     * **Internal Endpoint**: This endpoint is an API for the misskey mainframe and is not intended for use by third parties.
     * **Credential required**: *Yes*
     */
    request<E extends 'sw/update-registration', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Endpoint for testing input validation.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'test', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'username/available', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/achievements', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show all clips this user owns.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/clips', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/featured-notes', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show all flashs this user created.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/flashs', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show everyone that follows this user.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/followers', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show everyone that this user is following.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/following', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show all gallery posts by the given user.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/gallery/posts', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Retrieve users who have a birthday on the specified range.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:account*
     */
    request<E extends 'users/get-following-users-by-birthday', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Get a list of other users that the specified user frequently replies to.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/get-frequently-replied-users', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Create a new list of users.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/create', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/create-from-public', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Delete an existing list of users.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/delete', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/favorite', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No* / **Permission**: *read:account*
     */
    request<E extends 'users/lists/get-memberships', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show all lists that the authenticated user has created.
     * 
     * **Credential required**: *No* / **Permission**: *read:account*
     */
    request<E extends 'users/lists/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Remove a user from a list.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/pull', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Add a user to an existing list.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/push', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show the properties of a list.
     * 
     * **Credential required**: *No* / **Permission**: *read:account*
     */
    request<E extends 'users/lists/show', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/unfavorite', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Update the properties of a list.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/update', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/lists/update-membership', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/notes', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show all pages this user created.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/pages', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show all reactions this user made.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/reactions', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show users that the authenticated user might be interested to follow.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:account*
     */
    request<E extends 'users/recommendation', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show the different kinds of relations between the authenticated user and the specified user(s).
     * 
     * **Credential required**: *Yes* / **Permission**: *read:account*
     */
    request<E extends 'users/relation', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * File a report.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:report-abuse*
     */
    request<E extends 'users/report-abuse', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Search for users.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/search', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Search for a user by username and/or host.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/search-by-username-and-host', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * Show the properties of a user.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'users/show', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *write:account*
     */
    request<E extends 'users/update-memo', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *Yes* / **Permission**: *read:admin:emoji*
     */
    request<E extends 'v2/admin/emoji/list', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;

    /**
     * No description provided.
     * 
     * **Credential required**: *No*
     */
    request<E extends 'verify-email', P extends Endpoints[E]['req']>(
      endpoint: E,
      params: P,
      credential?: string | null,
    ): Promise<SwitchCaseResponseType<E, P>>;
  }
}

