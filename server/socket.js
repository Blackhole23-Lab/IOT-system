'use strict';
const { Server } = require('socket.io');

/**
 * In-memory store for rooms.
 * roomId -> { code, type:'teach'|'test', teacherSocketId, viewers:Set, state:{} }
 */
const rooms = new Map();

function getRoom(code) { return rooms.get(code); }

function createRoom(code, type) {
  const room = {
    code,
    type,
    teacherSocketId: null,
    viewers: new Set(),
    state: {
      pdfUrl: null,
      currentSlide: 0,
      currentZoom: 1.0,
      // exam state
      examStarted: false,
      examTitle: '',
      examId: null,
    },
  };
  rooms.set(code, room);
  return room;
}

function removeRoom(code) { rooms.delete(code); }

// ── Teach namespace ────────────────────────────────────────────────
function setupTeachNamespace(io) {
  const ns = io.of('/teach');

  ns.on('connection', (socket) => {
    // join-room: { code, role:'teacher'|'student' }
    socket.on('join-room', ({ code, role }) => {
      if (!code) return;
      let room = getRoom(code);
      if (!room) {
        // teacher creates the room; students can only join existing rooms
        if (role !== 'teacher') {
          socket.emit('error', { message: '房间不存在' });
          return;
        }
        room = createRoom(code, 'teach');
      }

      socket.join(code);
      socket.data.code = code;
      socket.data.role = role;

      if (role === 'teacher') {
        room.teacherSocketId = socket.id;
      } else {
        room.viewers.add(socket.id);
        ns.to(code).emit('room-status', { viewerCount: room.viewers.size });
      }

      // Send current room state to the joining socket
      socket.emit('current-state', {
        code,
        ...room.state,
        viewerCount: room.viewers.size,
        hasTeacher: !!room.teacherSocketId,
      });
    });

    // Teacher selected a PDF / changed PDF
    socket.on('pdf-uploaded', ({ code, pdfUrl }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      room.state.pdfUrl     = pdfUrl;
      room.state.currentSlide = 0;
      socket.to(code).emit('pdf-loaded', { pdfUrl });
    });

    // Slide navigation
    socket.on('slide-change', ({ code, indexh, indexv }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      room.state.currentSlide = indexh;
      socket.to(code).emit('slide-change', { indexh, indexv });
    });

    // Laser pointer
    socket.on('laser-move', ({ code, x, y }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      socket.to(code).emit('laser-move', { x, y });
    });

    socket.on('laser-hide', ({ code }) => {
      socket.to(code).emit('laser-hide', {});
    });

    // Zoom
    socket.on('zoom-change', ({ code, zoom }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      room.state.currentZoom = zoom;
      socket.to(code).emit('zoom-change', { zoom });
    });

    // Chalkboard draw events (bidirectional – both teacher and student can draw)
    socket.on('draw-event', ({ code, data }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.to(code).emit('draw-event', data);
    });

    socket.on('draw-clear', ({ code }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.to(code).emit('draw-clear', {});
    });

    socket.on('draw-stroke-start', ({ code }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.to(code).emit('draw-stroke-start', {});
    });

    socket.on('draw-rect', ({ code, data }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.to(code).emit('draw-rect', data);
    });

    socket.on('draw-undo', ({ code }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.to(code).emit('draw-undo', {});
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const { code, role } = socket.data || {};
      if (!code) return;
      const room = getRoom(code);
      if (!room) return;

      if (role === 'teacher') {
        room.teacherSocketId = null;
        ns.to(code).emit('teacher-left', {});
        // Optionally remove empty room after 10 min
        setTimeout(() => {
          const r = getRoom(code);
          if (r && !r.teacherSocketId && r.viewers.size === 0) removeRoom(code);
        }, 600_000);
      } else {
        room.viewers.delete(socket.id);
        ns.to(code).emit('room-status', { viewerCount: room.viewers.size });
      }
    });
  });
}

// ── Test namespace ─────────────────────────────────────────────────
function setupTestNamespace(io) {
  const ns = io.of('/test');

  ns.on('connection', (socket) => {
    socket.on('join-room', ({ code, role }) => {
      if (!code) return;
      let room = getRoom(code);
      if (!room) {
        if (role !== 'teacher') {
          socket.emit('error', { message: '考试房间不存在' });
          return;
        }
        room = createRoom(code, 'test');
      }

      socket.join(code);
      socket.data.code = code;
      socket.data.role = role;

      if (role === 'teacher') {
        room.teacherSocketId = socket.id;
      } else {
        room.viewers.add(socket.id);
        ns.to(code).emit('room-status', { viewerCount: room.viewers.size });
      }

      socket.emit('current-state', {
        code,
        ...room.state,
        viewerCount: room.viewers.size,
        hasTeacher: !!room.teacherSocketId,
      });
    });

    // Teacher starts the exam
    socket.on('exam-start', ({ code, title, examId }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      room.state.examStarted = true;
      room.state.examTitle   = title || '未命名考试';
      room.state.examId      = examId || null;
      ns.to(code).emit('exam-started', { title: room.state.examTitle, examId: room.state.examId });
    });

    // Teacher ends the exam
    socket.on('exam-end', ({ code }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      room.state.examStarted = false;
      ns.to(code).emit('exam-ended', {});
    });

    // Announcement broadcast
    socket.on('announce', ({ code, message }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.teacherSocketId) return;
      ns.to(code).emit('announcement', { message });
    });

    socket.on('disconnect', () => {
      const { code, role } = socket.data || {};
      if (!code) return;
      const room = getRoom(code);
      if (!room) return;
      if (role === 'teacher') {
        room.teacherSocketId = null;
        ns.to(code).emit('teacher-left', {});
      } else {
        room.viewers.delete(socket.id);
        ns.to(code).emit('room-status', { viewerCount: room.viewers.size });
      }
    });
  });
}

// ── Main attach function ───────────────────────────────────────────
function attachSockets(httpServer, corsOptions) {
  const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  setupTeachNamespace(io);
  setupTestNamespace(io);

  return io;
}

module.exports = { attachSockets, getRoom, createRoom, removeRoom };
