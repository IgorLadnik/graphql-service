
export const User = { type: 'User', id: 0, name: '', email: '', role: '' };
export const ChatMessage = { type: 'ChatMessage', id: 0, text: '', time: '', author: User };
export const Chat = { type: 'Chat', id: 0, topic: '', participants: [User], messages: [ChatMessage] };

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};
