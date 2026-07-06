import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { PlaylistService } from '../src/modules/playlist/playlist.service.js';

test('playlist queries require authentication', async () => {
  const playlistsQuery = '{ getMyPlaylists { id name } }';
  const result = await graphql({ schema, source: playlistsQuery, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('playlist mutations require authentication', async () => {
  const createMutation = 'mutation { createPlaylist(name: "My Music") { id name } }';
  const result = await graphql({ schema, source: createMutation, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('PlaylistService manages playlists successfully', async () => {
  let createdPlaylistInput = null;
  let deletedPlaylistId = null;
  let createdItemInput = null;
  let updatedOrders = [];

  const models = {
    AudioPlaylist: {
      create: async (input) => {
        createdPlaylistInput = input;
        return { id: 'playlist-1', ...input };
      },
      findOne: async ({ where }) => {
        if (where.id === 'playlist-1' && where.userId === 'user-1') {
          return {
            id: 'playlist-1',
            userId: 'user-1',
            name: 'Calm Music',
            destroy: async () => { deletedPlaylistId = 'playlist-1'; }
          };
        }
        return null;
      }
    },
    ContentItem: {
      findByPk: async (id) => {
        if (id === 'content-1') return { id: 'content-1' };
        return null;
      }
    },
    AudioPlaylistItem: {
      count: async () => 2,
      findOne: async () => null,
      create: async (input) => {
        createdItemInput = input;
        return { id: 'item-1', ...input };
      },
      findAll: async () => [
        { id: 'item-a', contentItemId: 'content-a', sortOrder: 0, save: async () => { updatedOrders.push('a'); } },
        { id: 'item-b', contentItemId: 'content-b', sortOrder: 1, save: async () => { updatedOrders.push('b'); } }
      ]
    }
  };

  const sequelize = {
    transaction: async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })
  };

  const service = new PlaylistService(models, sequelize);

  // 1. Create Playlist
  const playlist = await service.createPlaylist('user-1', 'Calm Music', 'Meditation tracks');
  assert.equal(playlist.userId, 'user-1');
  assert.equal(playlist.name, 'Calm Music');
  assert.equal(createdPlaylistInput.description, 'Meditation tracks');

  // 2. Add Playlist Item
  const item = await service.addPlaylistItem('user-1', 'playlist-1', 'content-1');
  assert.equal(item.playlistId, 'playlist-1');
  assert.equal(item.contentItemId, 'content-1');
  assert.equal(item.sortOrder, 2);

  // 3. Delete Playlist
  const success = await service.deletePlaylist('user-1', 'playlist-1');
  assert.equal(success, true);
  assert.equal(deletedPlaylistId, 'playlist-1');
});
