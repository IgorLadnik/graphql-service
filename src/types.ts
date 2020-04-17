
export const User = {
    type: 'User',
    id: 0,
    name: '',
    email: '',
    role: '',
    resolveFunc: (actionTree: any, args: any, context: any) => {
        context['User'] = 'a';
        console.log('resolveFunc for User');
    }
};

export const ChatMessage = {
    type: 'ChatMessage',
    id: 0,
    text: '',
    time: '',
    author: User,
    resolveFunc: (actionTree: any, args: any, context: any) => {
        console.log('resolveFunc for ChatMessage');
    }
};

export const Chat = {
    type: 'Chat',
    id: 0,
    topic: '',
    participants: [User],
    messages: [ChatMessage],
    resolveFunc: (actionTree: any, args: any, context: any) => {
        console.log('resolveFunc for Chat');
    }
};

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};
