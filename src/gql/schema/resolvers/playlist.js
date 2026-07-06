import { authenticate } from '../permissions/index.js';
import { PlaylistService } from '../../../modules/playlist/playlist.service.js';

export const playlistResolvers = {
  Query: {
    getMyPlaylists: authenticate(async (parent, args, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.getMyPlaylists(context.viewer.id);
    }),

    getPlaylistDetails: authenticate(async (parent, { id }, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.getPlaylistDetails(context.viewer.id, id);
    })
  },

  Mutation: {
    createPlaylist: authenticate(async (parent, { name, description }, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.createPlaylist(context.viewer.id, name, description);
    }),

    deletePlaylist: authenticate(async (parent, { id }, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.deletePlaylist(context.viewer.id, id);
    }),

    addPlaylistItem: authenticate(async (parent, { playlistId, contentItemId }, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.addPlaylistItem(context.viewer.id, playlistId, contentItemId);
    }),

    removePlaylistItem: authenticate(async (parent, { playlistId, contentItemId }, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.removePlaylistItem(context.viewer.id, playlistId, contentItemId);
    }),

    reorderPlaylistItem: authenticate(async (parent, { playlistId, contentItemId, newPosition }, context) => {
      const service = new PlaylistService(context.models, context.sequelize);
      return service.reorderPlaylistItem(context.viewer.id, playlistId, contentItemId, newPosition);
    })
  }
};
