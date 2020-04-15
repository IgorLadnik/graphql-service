export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

export type User = {
    type: 'User';
    id: number
    name: string;
    email: string;
    role: string;
}

export type ChatMessage = {
    type: 'ChatMessage';
    id: number;
    content: string;
    time: number;
    author: User;
}

export type Chat = {
    type: 'Chat';
    id: number;
    participants: Array<User>;
    messages: Array<ChatMessage>;
}