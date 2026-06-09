import { contentServiceInstance } from '../services/content.service.js';

class ContentController {
  async getContentIdeas(req, res, next) {
    try {
      const filters = { ...req.query, createdBy: req.user.id };
      const ideas = await contentServiceInstance.getContentIdeas(filters);
      res.status(200).json(ideas);
    } catch (error) {
      next(error);
    }
  }

  async createContentIdea(req, res, next) {
    try {
      const data = { ...req.body, createdBy: req.user.id };
      const idea = await contentServiceInstance.createContentIdea(data);
      res.status(201).json(idea);
    } catch (error) {
      next(error);
    }
  }

  async getContentIdeaById(req, res, next) {
    try {
      const idea = await contentServiceInstance.getContentIdeaById(req.params.id);
      res.status(200).json(idea);
    } catch (error) {
      next(error);
    }
  }

  async updateContentIdea(req, res, next) {
    try {
      const idea = await contentServiceInstance.updateContentIdea(req.params.id, req.body);
      res.status(200).json(idea);
    } catch (error) {
      next(error);
    }
  }

  async deleteContentIdea(req, res, next) {
    try {
      const result = await contentServiceInstance.deleteContentIdea(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async scheduleContentIdea(req, res, next) {
    try {
      const idea = await contentServiceInstance.scheduleContentIdea(req.params.id, req.body);
      res.status(200).json(idea);
    } catch (error) {
      next(error);
    }
  }

  // Posts Controllers
  async getPosts(req, res, next) {
    try {
      const filters = { ...req.query, createdBy: req.user.id };
      const posts = await contentServiceInstance.getPosts(filters);
      res.status(200).json(posts);
    } catch (error) {
      next(error);
    }
  }

  async createPost(req, res, next) {
    try {
      const data = { ...req.body, createdBy: req.user.id };
      const post = await contentServiceInstance.createPost(data);
      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  }

  async getPostById(req, res, next) {
    try {
      const post = await contentServiceInstance.getPostById(req.params.id);
      res.status(200).json(post);
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req, res, next) {
    try {
      const post = await contentServiceInstance.updatePost(req.params.id, req.body);
      res.status(200).json(post);
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req, res, next) {
    try {
      const result = await contentServiceInstance.deletePost(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async publishPostNow(req, res, next) {
    try {
      const post = await contentServiceInstance.publishPostNow(req.params.id);
      res.status(200).json(post);
    } catch (error) {
      next(error);
    }
  }
}

export const contentControllerInstance = new ContentController();
