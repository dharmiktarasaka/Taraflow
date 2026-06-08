import ContentIdea from '../models/contentIdea.model.js';
import Post from '../models/post.model.js';
import { NotFoundError } from '../utils/errors.util.js';
import { postPublisherServiceInstance } from './postPublisher.service.js';

class ContentService {
  async getContentIdeas(filters = {}) {
    // Check if empty, populate with default seed ideas for visual preview
    const count = await ContentIdea.countDocuments();
    if (count === 0) {
      await ContentIdea.insertMany([
        {
          title: '10 AI Tools for Content Creators in 2026',
          description: 'A curated list of state-of-the-art LLM and image generation automation tools.',
          status: 'idea',
          platform: 'linkedin',
          contentType: 'carousel',
          aiGenerated: true,
          tags: ['aicreation', 'marketing'],
        },
        {
          title: 'Why Rich UI Aesthetics Drive SaaS Conversions',
          description: 'Exploring HSL colors, smooth transitions, and premium layouts impact on landing pages.',
          status: 'approved',
          platform: 'instagram',
          contentType: 'post',
          aiGenerated: false,
          tags: ['webdesign', 'saas'],
        },
        {
          title: 'BullMQ Post Scheduling: Behind the Scenes',
          description: 'How Redis-backed queues schedule thousands of parallel posts without blocking main processes.',
          status: 'scheduled',
          platform: 'twitter',
          contentType: 'post',
          aiGenerated: true,
          tags: ['nodejs', 'redis'],
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      ]);
    }

    return ContentIdea.find(filters).sort({ createdAt: -1 });
  }

  async createContentIdea(data) {
    return ContentIdea.create(data);
  }

  async getContentIdeaById(id) {
    const idea = await ContentIdea.findById(id);
    if (!idea) throw new NotFoundError('Content idea not found');
    return idea;
  }

  async updateContentIdea(id, data) {
    const idea = await ContentIdea.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!idea) throw new NotFoundError('Content idea not found');
    return idea;
  }

  async deleteContentIdea(id) {
    const idea = await ContentIdea.findByIdAndDelete(id);
    if (!idea) throw new NotFoundError('Content idea not found');
    return { success: true };
  }

  async scheduleContentIdea(id, scheduleData) {
    const { scheduledFor, platform } = scheduleData;
    const idea = await ContentIdea.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'scheduled',
          scheduledFor: new Date(scheduledFor),
          platform: platform,
        },
      },
      { new: true }
    );
    if (!idea) throw new NotFoundError('Content idea not found');
    return idea;
  }

  // Posts operations
  async getPosts(filters = {}) {
    return Post.find(filters).sort({ createdAt: -1 });
  }

  async createPost(data) {
    return Post.create(data);
  }

  async getPostById(id) {
    const post = await Post.findById(id);
    if (!post) throw new NotFoundError('Post not found');
    return post;
  }

  async updatePost(id, data) {
    const post = await Post.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!post) throw new NotFoundError('Post not found');
    return post;
  }

  async deletePost(id) {
    const post = await Post.findByIdAndDelete(id);
    if (!post) throw new NotFoundError('Post not found');
    return { success: true };
  }

  async publishPostNow(id) {
    const post = await Post.findById(id);
    if (!post) throw new NotFoundError('Post not found');

    post.status = 'PUBLISHING';
    await post.save();

    try {
      const publishResult = await postPublisherServiceInstance.publish(post);
      
      post.status = 'PUBLISHED';
      post.publishedAt = new Date();
      post.platformPostId = publishResult.platformPostId;
      post.publishError = null;
      await post.save();
      return post;
    } catch (err) {
      post.status = 'FAILED';
      post.publishError = err.message;
      await post.save();
      return post;
    }
  }
}

export const contentServiceInstance = new ContentService();
