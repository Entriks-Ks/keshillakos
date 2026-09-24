"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCIAL_LINK_KEYS = void 0;
exports.socialLinkLabel = socialLinkLabel;
exports.normalizeSocialLinks = normalizeSocialLinks;
exports.applySocialLinks = applySocialLinks;
exports.hasAnySocialLink = hasAnySocialLink;
exports.socialLinksSchemaDefinition = socialLinksSchemaDefinition;
exports.SOCIAL_LINK_KEYS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'];
const SOCIAL_HOST_PATTERN = {
    instagram: /(?:^|\.)instagram\.com$/i,
    facebook: /(?:^|\.)(?:facebook\.com|fb\.com)$/i,
    linkedin: /(?:^|\.)linkedin\.com$/i,
    tiktok: /(?:^|\.)tiktok\.com$/i,
    youtube: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i,
    twitter: /(?:^|\.)(?:twitter\.com|x\.com)$/i,
};
const SOCIAL_LABEL = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    twitter: 'X / Twitter',
};
function socialLinkLabel(key) {
    return SOCIAL_LABEL[key];
}
function assertSocialUrl(key, trimmed) {
    let url;
    try {
        url = new URL(trimmed);
    }
    catch {
        throw new Error(`${SOCIAL_LABEL[key]}: URL i pavlefshëm`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`${SOCIAL_LABEL[key]}: URL duhet të fillojë me http:// ose https://`);
    }
    if (!SOCIAL_HOST_PATTERN[key].test(url.hostname)) {
        throw new Error(`${SOCIAL_LABEL[key]}: lidhja duhet të jetë e platformatës së duhur`);
    }
    return url.toString();
}
/** Normalize optional social URLs; empty strings clear the field. Throws on invalid URLs. */
function normalizeSocialLinks(input) {
    if (input === undefined)
        return undefined;
    if (input === null)
        return {};
    const next = {};
    for (const key of exports.SOCIAL_LINK_KEYS) {
        const raw = input[key];
        if (raw === undefined)
            continue;
        const trimmed = typeof raw === 'string' ? raw.trim() : '';
        if (!trimmed) {
            next[key] = undefined;
            continue;
        }
        next[key] = assertSocialUrl(key, trimmed);
    }
    return next;
}
function applySocialLinks(target, patch) {
    const merged = { ...(target || {}) };
    for (const key of exports.SOCIAL_LINK_KEYS) {
        if (!(key in patch))
            continue;
        const value = patch[key];
        if (!value)
            delete merged[key];
        else
            merged[key] = value;
    }
    return Object.keys(merged).length ? merged : undefined;
}
function hasAnySocialLink(links) {
    if (!links)
        return false;
    return exports.SOCIAL_LINK_KEYS.some((key) => Boolean(links[key]?.trim()));
}
/** Used only for mongoose schema shape; runtime validation goes through normalizeSocialLinks. */
function socialLinksSchemaDefinition() {
    return {
        instagram: { type: String, trim: true, maxlength: 500 },
        facebook: { type: String, trim: true, maxlength: 500 },
        linkedin: { type: String, trim: true, maxlength: 500 },
        tiktok: { type: String, trim: true, maxlength: 500 },
        youtube: { type: String, trim: true, maxlength: 500 },
        twitter: { type: String, trim: true, maxlength: 500 },
    };
}
//# sourceMappingURL=socialLinks.js.map