"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachRealtimeSocket = attachRealtimeSocket;
const socket_io_1 = require("socket.io");
const firebaseAuth_1 = require("./firebaseAuth");
const userService_1 = require("./userService");
const realtime_1 = require("./realtime");
const presenceSocket_1 = require("./presenceSocket");
function attachRealtimeSocket(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: true, credentials: true },
        path: '/socket.io',
        pingInterval: 25000,
        pingTimeout: 20000,
    });
    (0, realtime_1.setRealtimeServer)(io);
    io.use(async (socket, next) => {
        try {
            const token = (typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token) ||
                (typeof socket.handshake.headers.authorization === 'string'
                    ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
                    : '');
            if (!token) {
                return next(new Error('Mungon tokeni'));
            }
            const firebaseUser = await (0, firebaseAuth_1.firebaseVerifyIdToken)(token);
            const dbUser = await (0, userService_1.findUserByUid)(firebaseUser.localId);
            if (dbUser && dbUser.accountStatus && dbUser.accountStatus !== 'active') {
                return next(new Error('Llogaria nuk është aktive'));
            }
            const user = {
                uid: firebaseUser.localId,
                name: dbUser?.name || firebaseUser.displayName || 'User',
            };
            socket.data.user = user;
            next();
        }
        catch (err) {
            next(err instanceof Error ? err : new Error('Autentifikim i dështuar'));
        }
    });
    io.on('connection', socket => {
        const user = socket.data.user;
        void socket.join(`user:${user.uid}`);
    });
    (0, presenceSocket_1.registerPresence)(io);
    return io;
}
//# sourceMappingURL=socketServer.js.map