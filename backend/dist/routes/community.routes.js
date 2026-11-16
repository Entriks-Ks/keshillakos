"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const CommunityPost_1 = require("../models/CommunityPost");
const CommunityComment_1 = require("../models/CommunityComment");
const Notification_1 = require("../models/Notification");
const router = (0, express_1.Router)();
// GET /api/community/posts - List community posts with filters
router.get('/posts', async (req, res) => {
    try {
        const { category, city, status, search, sort = 'recent', page = '1', limit = '15', } = req.query;
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 15));
        const skip = (pageNum - 1) * limitNum;
        const filter = {};
        if (category && category !== 'all') {
            filter.category = String(category).toLowerCase();
        }
        if (city && city !== 'all') {
            filter.city = new RegExp(`^${String(city).trim()}$`, 'i');
        }
        if (status && status !== 'all') {
            filter.status = status;
        }
        if (search && String(search).trim()) {
            const q = String(search).trim();
            filter.$or = [
                { title: { $regex: q, $options: 'i' } },
                { content: { $regex: q, $options: 'i' } },
            ];
        }
        let sortObj = { createdAt: -1 };
        if (sort === 'popular') {
            sortObj = { commentsCount: -1, createdAt: -1 };
        }
        else if (sort === 'unanswered') {
            filter.commentsCount = 0;
            sortObj = { createdAt: -1 };
        }
        else if (sort === 'resolved') {
            filter.status = 'resolved';
            sortObj = { createdAt: -1 };
        }
        const [posts, total] = await Promise.all([
            CommunityPost_1.CommunityPost.find(filter).sort(sortObj).skip(skip).limit(limitNum).lean(),
            CommunityPost_1.CommunityPost.countDocuments(filter),
        ]);
        res.json({
            posts,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
        });
    }
    catch (err) {
        console.error('Error fetching community posts:', err);
        res.status(500).json({ message: 'Gabim gjatë marrjes së postimeve të komunitetit' });
    }
});
// GET /api/community/posts/:id - Single post
router.get('/posts/:id', async (req, res) => {
    try {
        const post = await CommunityPost_1.CommunityPost.findById(req.params.id).lean();
        if (!post) {
            return res.status(404).json({ message: 'Postimi nuk u gjet' });
        }
        res.json(post);
    }
    catch (err) {
        res.status(500).json({ message: 'Gabim gjatë ngarkimit të postimit' });
    }
});
// POST /api/community/posts - Create post
router.post('/posts', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { title, content, category, city, budget } = req.body;
        if (!title || typeof title !== 'string' || title.trim().length < 5) {
            return res.status(400).json({ message: 'Titulli duhet të ketë së paku 5 karaktere' });
        }
        if (!content || typeof content !== 'string' || content.trim().length < 10) {
            return res.status(400).json({ message: 'Përshkrimi i kërkesës duhet të ketë së paku 10 karaktere' });
        }
        const validCategories = ['avokat', 'kontabilitet', 'noter', 'biznes', 'patundshmeri', 'tjeter'];
        const cat = validCategories.includes(String(category).toLowerCase())
            ? String(category).toLowerCase()
            : 'avokat';
        const post = await CommunityPost_1.CommunityPost.create({
            authorUid: user.uid,
            authorName: user.name || 'Përdorues',
            authorRole: user.activeContext || user.role || 'user',
            authorPhoto: user.profilePhoto || '',
            title: title.trim(),
            content: content.trim(),
            category: cat,
            city: typeof city === 'string' ? city.trim() : '',
            budget: typeof budget === 'string' ? budget.trim() : '',
            likes: [],
            commentsCount: 0,
            status: 'open',
        });
        res.status(201).json(post);
    }
    catch (err) {
        console.error('Error creating community post:', err);
        res.status(500).json({ message: 'Gabim gjatë krijimit të postimit' });
    }
});
// PATCH /api/community/posts/:id/status - Update post status (e.g. mark resolved)
router.patch('/posts/:id/status', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { status } = req.body;
        if (!['open', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({ message: 'Status i pavlefshëm' });
        }
        const post = await CommunityPost_1.CommunityPost.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Postimi nuk u gjet' });
        }
        const isAdmin = user.roles?.includes('admin') || user.role === 'admin';
        if (post.authorUid !== user.uid && !isAdmin) {
            return res.status(403).json({ message: 'Nuk keni leje për të ndryshuar statusin e këtij postimi' });
        }
        post.status = status;
        await post.save();
        res.json(post);
    }
    catch (err) {
        res.status(500).json({ message: 'Gabim gjatë përditësimit të statusit' });
    }
});
// DELETE /api/community/posts/:id - Delete post
router.delete('/posts/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const post = await CommunityPost_1.CommunityPost.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Postimi nuk u gjet' });
        }
        const isAdmin = user.roles?.includes('admin') || user.role === 'admin';
        if (post.authorUid !== user.uid && !isAdmin) {
            return res.status(403).json({ message: 'Nuk keni leje për të fshirë këtë postim' });
        }
        await CommunityPost_1.CommunityPost.findByIdAndDelete(post._id);
        await CommunityComment_1.CommunityComment.deleteMany({ postId: post._id });
        res.json({ success: true, message: 'Postimi u fshi me sukses' });
    }
    catch (err) {
        console.error('Error deleting community post:', err);
        res.status(500).json({ message: 'Gabim gjatë fshirjes së postimit' });
    }
});
// POST /api/community/posts/:id/like - Toggle like on post
router.post('/posts/:id/like', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const post = await CommunityPost_1.CommunityPost.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Postimi nuk u gjet' });
        }
        const uid = user.uid;
        const hasLiked = post.likes.includes(uid);
        if (hasLiked) {
            post.likes = post.likes.filter((id) => id !== uid);
        }
        else {
            post.likes.push(uid);
        }
        await post.save();
        res.json({
            liked: !hasLiked,
            likesCount: post.likes.length,
            likes: post.likes,
        });
    }
    catch (err) {
        res.status(500).json({ message: 'Gabim gjatë pëlqimit' });
    }
});
// GET /api/community/posts/:id/comments - List comments for post
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const comments = await CommunityComment_1.CommunityComment.find({ postId: req.params.id })
            .sort({ createdAt: 1 })
            .lean();
        res.json(comments);
    }
    catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({ message: 'Gabim gjatë marrjes së komenteve' });
    }
});
// POST /api/community/posts/:id/comments - Add comment to post
router.post('/posts/:id/comments', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { content, suggestedPrice, suggestedProviderUid, suggestedProviderName } = req.body;
        if (!content || typeof content !== 'string' || content.trim().length < 2) {
            return res.status(400).json({ message: 'Komenti duhet të ketë së paku 2 karaktere' });
        }
        const post = await CommunityPost_1.CommunityPost.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Postimi nuk u gjet' });
        }
        const comment = await CommunityComment_1.CommunityComment.create({
            postId: post._id,
            authorUid: user.uid,
            authorName: user.name || 'Përdorues',
            authorRole: user.activeContext || user.role || 'user',
            authorPhoto: user.profilePhoto || '',
            content: content.trim(),
            suggestedPrice: typeof suggestedPrice === 'string' ? suggestedPrice.trim().slice(0, 50) : '',
            suggestedProviderUid: typeof suggestedProviderUid === 'string' ? suggestedProviderUid.trim() : '',
            suggestedProviderName: typeof suggestedProviderName === 'string' ? suggestedProviderName.trim().slice(0, 100) : '',
            likes: [],
        });
        post.commentsCount = (post.commentsCount || 0) + 1;
        await post.save();
        // Send in-app notification if the commenter is not the post author
        if (post.authorUid && post.authorUid !== user.uid) {
            Notification_1.Notification.create({
                recipientUid: post.authorUid,
                type: 'community_comment',
                title: `${user.name || 'Një anëtar'} komentoi në kërkesën tënde`,
                body: content.trim().slice(0, 120),
                href: `/komuniteti#post-${post._id}`,
                eventKey: `comm-comment-${comment._id}`,
            }).catch((notifErr) => {
                console.warn('Failed to dispatch community comment notification:', notifErr);
            });
        }
        res.status(201).json(comment);
    }
    catch (err) {
        console.error('Error creating comment:', err);
        res.status(500).json({ message: 'Gabim gjatë krijimit të komentit' });
    }
});
// DELETE /api/community/posts/:id/comments/:commentId - Delete comment
router.delete('/posts/:id/comments/:commentId', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const comment = await CommunityComment_1.CommunityComment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Komenti nuk u gjet' });
        }
        const isAdmin = user.roles?.includes('admin') || user.role === 'admin';
        if (comment.authorUid !== user.uid && !isAdmin) {
            return res.status(403).json({ message: 'Nuk keni leje për të fshirë këtë koment' });
        }
        await CommunityComment_1.CommunityComment.findByIdAndDelete(comment._id);
        // Decrement commentsCount on post
        await CommunityPost_1.CommunityPost.findByIdAndUpdate(req.params.id, {
            $inc: { commentsCount: -1 },
        });
        res.json({ success: true, message: 'Komenti u fshi me sukses' });
    }
    catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ message: 'Gabim gjatë fshirjes së komentit' });
    }
});
// POST /api/community/posts/:id/comments/:commentId/like - Toggle like on comment
router.post('/posts/:id/comments/:commentId/like', auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const comment = await CommunityComment_1.CommunityComment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Komenti nuk u gjet' });
        }
        const uid = user.uid;
        const hasLiked = comment.likes.includes(uid);
        if (hasLiked) {
            comment.likes = comment.likes.filter((id) => id !== uid);
        }
        else {
            comment.likes.push(uid);
        }
        await comment.save();
        res.json({
            liked: !hasLiked,
            likesCount: comment.likes.length,
            likes: comment.likes,
        });
    }
    catch (err) {
        res.status(500).json({ message: 'Gabim gjatë pëlqimit të komentit' });
    }
});
exports.default = router;
//# sourceMappingURL=community.routes.js.map