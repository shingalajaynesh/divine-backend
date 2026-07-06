import { z } from 'zod';

export class PlaylistService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getMyPlaylists(userId) {
    return this.models.AudioPlaylist.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: this.models.AudioPlaylistItem,
          as: 'items',
          include: [
            {
              model: this.models.ContentItem,
              as: 'contentItem',
              include: [
                { model: this.models.ContentTranslation, as: 'translations' }
              ]
            }
          ]
        }
      ]
    });
  }

  async getPlaylistDetails(userId, playlistId) {
    const playlist = await this.models.AudioPlaylist.findOne({
      where: { id: playlistId, userId },
      include: [
        {
          model: this.models.AudioPlaylistItem,
          as: 'items',
          include: [
            {
              model: this.models.ContentItem,
              as: 'contentItem',
              include: [
                { model: this.models.ContentTranslation, as: 'translations' }
              ]
            }
          ]
        }
      ],
      order: [[{ model: this.models.AudioPlaylistItem, as: 'items' }, 'sortOrder', 'ASC']]
    });

    if (!playlist) {
      throw new Error('Playlist not found.');
    }

    return playlist;
  }

  async createPlaylist(userId, name, description) {
    const cleanName = z.string().min(1).max(100).parse(name.trim());
    const cleanDesc = description ? z.string().max(500).parse(description.trim()) : null;

    return this.models.AudioPlaylist.create({
      userId,
      name: cleanName,
      description: cleanDesc
    });
  }

  async deletePlaylist(userId, playlistId) {
    const playlist = await this.models.AudioPlaylist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      throw new Error('Playlist not found.');
    }
    await playlist.destroy();
    return true;
  }

  async addPlaylistItem(userId, playlistId, contentItemId) {
    const playlist = await this.models.AudioPlaylist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      throw new Error('Playlist not found.');
    }

    const contentItem = await this.models.ContentItem.findByPk(contentItemId);
    if (!contentItem) {
      throw new Error('Content item not found.');
    }

    return this.sequelize.transaction(async (transaction) => {
      const existing = await this.models.AudioPlaylistItem.findOne({
        where: { playlistId, contentItemId },
        transaction
      });

      if (existing) {
        return existing;
      }

      const count = await this.models.AudioPlaylistItem.count({
        where: { playlistId },
        transaction
      });

      return this.models.AudioPlaylistItem.create({
        playlistId,
        contentItemId,
        sortOrder: count
      }, { transaction });
    });
  }

  async removePlaylistItem(userId, playlistId, contentItemId) {
    const playlist = await this.models.AudioPlaylist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      throw new Error('Playlist not found.');
    }

    const item = await this.models.AudioPlaylistItem.findOne({
      where: { playlistId, contentItemId }
    });

    if (!item) {
      return false;
    }

    await item.destroy();
    return true;
  }

  async reorderPlaylistItem(userId, playlistId, contentItemId, newPosition) {
    const playlist = await this.models.AudioPlaylist.findOne({ where: { id: playlistId, userId } });
    if (!playlist) {
      throw new Error('Playlist not found.');
    }

    const items = await this.models.AudioPlaylistItem.findAll({
      where: { playlistId },
      order: [['sortOrder', 'ASC']]
    });

    const targetIndex = items.findIndex(item => item.contentItemId === contentItemId);
    if (targetIndex === -1) {
      throw new Error('Item not found in playlist.');
    }

    return this.sequelize.transaction(async (transaction) => {
      const targetItem = items[targetIndex];
      items.splice(targetIndex, 1);
      
      const clampedPosition = Math.max(0, Math.min(newPosition, items.length));
      items.splice(clampedPosition, 0, targetItem);

      for (let i = 0; i < items.length; i++) {
        items[i].sortOrder = i;
        await items[i].save({ transaction });
      }

      return true;
    });
  }
}
