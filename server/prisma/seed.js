'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Seed users — only admin account
  const users = [
    { id: 'u5', username: 'admin', password: 'admin123', role: 'admin', name: '系统管理员', email: 'admin@system.local', permissions: '["*"]' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: u,
    });
  }

  // Seed questions
  const sampleQuestions = [
    { id: 'q1',  type: 'single',   questionText: '以下哪种协议是物联网通信中最常用的轻量级消息传输协议？', options: JSON.stringify(['HTTP', 'MQTT', 'FTP', 'SMTP']), answer: '2', score: 5 },
    { id: 'q2',  type: 'single',   questionText: 'TCP/IP 协议中，哪一层负责端到端的可靠传输？', options: JSON.stringify(['网络层', '传输层', '应用层', '数据链路层']), answer: '2', score: 5 },
    { id: 'q3',  type: 'single',   questionText: 'SQL 注入攻击的根本原因是什么？', options: JSON.stringify(['网络速度慢', '用户输入未经验证直接拼接进SQL', '数据库版本过旧', '服务器内存不足']), answer: '2', score: 5 },
    { id: 'q4',  type: 'multiple', questionText: '以下哪些属于常见的 Web 安全漏洞（OWASP Top 10）？', options: JSON.stringify(['SQL注入', 'XSS跨站脚本', '目录遍历', '内存溢出', '弱口令']), answer: JSON.stringify(['1','2','3','5']), score: 10 },
    { id: 'q5',  type: 'multiple', questionText: 'HTTPS 相比 HTTP 的改进包括哪些？', options: JSON.stringify(['数据加密', '身份认证', '传输更快', '完整性保护', '无需证书']), answer: JSON.stringify(['1','2','4']), score: 10 },
    { id: 'q6',  type: 'judge',    questionText: 'ARP 协议工作在网络层（第三层）', options: JSON.stringify([]), answer: 'false', score: 5 },
    { id: 'q7',  type: 'judge',    questionText: 'HTTPS 默认使用 443 端口', options: JSON.stringify([]), answer: 'true', score: 5 },
    { id: 'q8',  type: 'judge',    questionText: 'MD5 目前被认为是安全的密码哈希算法', options: JSON.stringify([]), answer: 'false', score: 5 },
    { id: 'q9',  type: 'code',     questionText: '请用 Python 编写一个简单的端口扫描器，扫描目标主机的 1-1024 端口，输出开放的端口列表。', options: JSON.stringify([]), answer: 'import socket\ndef scan_ports(host):\n    open_ports = []\n    for port in range(1, 1025):\n        s = socket.socket()\n        s.settimeout(0.5)\n        if s.connect_ex((host, port)) == 0:\n            open_ports.append(port)\n        s.close()\n    return open_ports', score: 20 },
    { id: 'q10', type: 'essay',    questionText: '简述对称加密和非对称加密的区别，并各举一个典型算法。', options: JSON.stringify([]), answer: '对称加密使用同一密钥加解密，速度快，典型算法有AES、DES；非对称加密使用公钥加密、私钥解密，安全性高但速度慢，典型算法有RSA、ECC。', score: 15 },
  ];

  for (const q of sampleQuestions) {
    await prisma.question.upsert({ where: { id: q.id }, update: {}, create: q });
  }

  // Seed sample exam
  const sampleQIds = ['q1','q2','q3','q4','q6','q7'];
  const totalScore = sampleQuestions.filter(q => sampleQIds.includes(q.id)).reduce((s, q) => s + q.score, 0);
  await prisma.exam.upsert({
    where: { id: 'e1' },
    update: {},
    create: {
      id: 'e1',
      title: '网络安全基础知识测验',
      duration: 30,
      totalScore,
      questionIds: JSON.stringify(sampleQIds),
      createdBy: 'u1',
    },
  });

  console.log('✅ Seed complete');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
