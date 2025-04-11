import { Server } from 'socket.io';
import { NextApiRequest } from 'next';
import { Server as NetServer } from 'http';
import { getSession } from 'next-auth/react';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: any) => {
  if (!res.socket.server.io) {
    const httpServer: NetServer = res.socket.server as any;
    const io = new Server(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    io.use(async (socket, next) => {
      const session = await getSession({ req: socket.request as any });
      if (!session) {
        next(new Error('Unauthorized'));
        return;
      }
      socket.data.userId = session.user.id;
      next();
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.data.userId);

      socket.join(`user:${socket.data.userId}`);

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.data.userId);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export default ioHandler; 