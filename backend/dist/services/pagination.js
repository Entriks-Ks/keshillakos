"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePagination = void 0;
exports.paginationInput = paginationInput;
exports.paginationMeta = paginationMeta;
exports.paginateItems = paginateItems;
exports.queryPage = queryPage;
function paginationInput(query, defaultLimit = 12) {
    const parse = (value, fallback) => {
        if (value === undefined)
            return fallback;
        if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
            throw new Error('Faqja dhe kufiri duhet të jenë numra të plotë pozitivë');
        return Number(value);
    };
    return { page: parse(query.page, 1), limit: Math.min(parse(query.limit, defaultLimit), 100) };
}
const validatePagination = (req, res, next) => {
    try {
        paginationInput(req.query);
        for (const key of ['expertsPage', 'invitationsPage', 'publishedPage'])
            if (req.query[key] !== undefined)
                paginationInput({ page: req.query[key] });
        next();
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'Faqe e pavlefshme' });
    }
};
exports.validatePagination = validatePagination;
function paginationMeta(input, total) {
    const totalPages = Math.ceil(total / input.limit);
    return { ...input, page: Math.min(input.page, Math.max(1, totalPages)), total, totalPages };
}
/** Derived collections combine canonical and legacy records before paging on the server. */
function paginateItems(items, input) {
    const pagination = paginationMeta(input, items.length);
    const start = (pagination.page - 1) * pagination.limit;
    return { items: items.slice(start, start + pagination.limit), pagination };
}
/** Count before applying an offset; clamp after deletions so the last page stays valid. */
async function queryPage(input, count, read) {
    let pagination = paginationMeta(input, await count());
    let items = await read((pagination.page - 1) * pagination.limit, pagination.limit);
    // A deletion can also happen between the count and the read.
    if (!items.length && pagination.page > 1) {
        pagination = paginationMeta(input, await count());
        items = await read((pagination.page - 1) * pagination.limit, pagination.limit);
    }
    return { items, pagination };
}
//# sourceMappingURL=pagination.js.map