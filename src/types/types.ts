import { typesCommon } from '../app';

export type ResolveFunc = (field: any, args: any, contextConst: any, contextVar: any) => void;

export class ClassCommon {
    constructor(
        public type: string,
        public id: number,
        public resolveFunc: ResolveFunc = (field, args, contextConst, contextVar)  =>
            typesCommon.filter(this.type, contextVar)
        ) { }
}

export class ClassUser extends ClassCommon {
    constructor(
        id: number = 0,
        public name: string = '',
        public email: string = '',
        public role: string = ''
    ) {
        super('User', id);
    };
}

export const User = new ClassUser();

export class ClassChatMessage extends ClassCommon {
    constructor(
        id: number = 0,
        public text: string = '',
        public time: string = '',
        public author: ClassUser = User
    ) {
        super('ChatMessage', id);
    }
}

export const ChatMessage = new ClassChatMessage();

export class ClassChat extends ClassCommon {
    constructor(
        id: number = 0,
        public topic: string = '',
        public participants: Array<ClassUser> = [User],
        public messages: Array<ClassChatMessage> = [ChatMessage]
    ) {
        super('Chat', id);
    }
}

export const Chat = new ClassChat();

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

