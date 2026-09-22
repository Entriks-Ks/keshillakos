"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_LABELS = exports.ROLES = void 0;
exports.isUserRole = isUserRole;
exports.ROLES = ['user', 'provider', 'company', 'admin'];
function isUserRole(value) {
    return typeof value === 'string' && exports.ROLES.includes(value);
}
exports.ROLE_LABELS = {
    user: 'Përdorues',
    provider: 'Ofrues shërbimi',
    company: 'Kompani',
    admin: 'Admin',
};
//# sourceMappingURL=roles.js.map