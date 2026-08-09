/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import type { Packed } from '@/misc/json-schema.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type ChannelRequest } from '../channel.js';
import { REQUEST } from '@nestjs/core';

@Injectable({ scope: Scope.TRANSIENT })
export class HomeTimelineChannel extends Channel {
	public readonly chName = 'homeTimeline';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:account';
	private withRenotes: boolean;
	private withFiles: boolean;
	private mutualOnly: boolean;
	/**
	 * Reverse-follow checks are kept per stream connection, never as an author's
	 * complete follower list. This keeps memory bounded even for popular users.
	 */
	private mutualRelationCache = new Map<string, { value: boolean; expiresAt: number }>();
	private static readonly mutualRelationCacheLifetime = 1000 * 60;
	private static readonly mutualRelationCacheMaxEntries = 256;

	constructor(
		@Inject(REQUEST)
		request: ChannelRequest,

		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
		private userFollowingService: UserFollowingService,
	) {
		super(request);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		this.withRenotes = !!(params.withRenotes ?? true);
		this.withFiles = !!(params.withFiles ?? false);
		this.mutualOnly = !!(params.mutualOnly ?? false);

		this.subscriber.on('notesStream', this.onNote);
		if (this.mutualOnly) {
			this.subscriber.on('internal', this.onInternalEvent);
		}
	}

	@bindThis
	private onInternalEvent(event: GlobalEvents['internal']['payload']) {
		if (event.type !== 'follow' && event.type !== 'unfollow') return;

		// The relation used here is author -> current user. Normal follow/unfollow
		// events invalidate it immediately; the short TTL covers exceptional paths.
		if (event.body.followeeId === this.user?.id) {
			this.mutualRelationCache.delete(event.body.followerId);
		}
	}

	@bindThis
	private async isMutualAuthor(userId: string): Promise<boolean> {
		if (!Object.hasOwn(this.following, userId)) return false;

		const cached = this.mutualRelationCache.get(userId);
		const now = Date.now();
		if (cached && cached.expiresAt > now) return cached.value;

		const value = await this.userFollowingService.isFollowing(userId, this.user!.id);
		if (this.mutualRelationCache.size >= HomeTimelineChannel.mutualRelationCacheMaxEntries) {
			const oldestKey = this.mutualRelationCache.keys().next().value;
			if (oldestKey) this.mutualRelationCache.delete(oldestKey);
		}
		this.mutualRelationCache.set(userId, {
			value,
			expiresAt: now + HomeTimelineChannel.mutualRelationCacheLifetime,
		});
		return value;
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		const isMe = this.user!.id === note.userId;

		if (this.mutualOnly) {
			if (note.channelId) return;
			if (!isMe) {
				const isMutual = await this.isMutualAuthor(note.userId);
				if (!isMutual) return;
			}
		}

		if (this.withFiles && (note.fileIds == null || note.fileIds.length === 0)) return;

		if (note.channelId) {
			// そのチャンネルをフォローしていない
			if (!this.followingChannels.has(note.channelId)) {
				return;
			}
		} else {
			// その投稿のユーザーをフォローしていなかったら弾く
			if (!isMe && !Object.hasOwn(this.following, note.userId)) return;
		}

		if (!this.isNoteVisibleForMe(note)) return;

		if (note.reply) {
			const reply = note.reply;
			if (this.following[note.userId]?.withReplies) {
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信は弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId) && reply.userId !== this.user!.id) return;
			} else {
				// 「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信」でもない場合
				if (reply.userId !== this.user!.id && !isMe && reply.userId !== note.userId) return;
			}
		}

		// 純粋なリノート（引用リノートでないリノート）の場合
		if (isRenotePacked(note) && !isQuotePacked(note) && note.renote) {
			if (!this.withRenotes) return;
			if (note.renote.reply) {
				const reply = note.renote.reply;
				// 自分のフォローしていないユーザーの visibility: followers な投稿への返信のリノートは弾く
				if (reply.visibility === 'followers' && !Object.hasOwn(this.following, reply.userId) && reply.userId !== this.user!.id) return;
			}
		}

		if (this.isNoteMutedOrBlocked(note)) return;

		const filtered = await this.noteStreamingHidingService.filter(note, this.user?.id ?? null);
		if (!filtered) return;
		// eslint-disable-next-line no-param-reassign -- これ以降元の Note オブジェクトは見てはいけないので、いっそ再代入した方が安全
		note = filtered;

		if (this.user) {
			if (isRenotePacked(note) && !isQuotePacked(note)) {
				if (note.renote && Object.keys(note.renote.reactions).length > 0) {
					const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
					note.renote.myReaction = myRenoteReaction;
				}
			}
		}

		this.send('note', note);
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
		if (this.mutualOnly) {
			this.subscriber.off('internal', this.onInternalEvent);
		}
		this.mutualRelationCache.clear();
	}
}
