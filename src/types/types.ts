import { gqlTypesCommon } from '../app';

export type ResolveFunc = (field: any, args: any, contextConst: any, contextVar: any) => void;

export class ClassCommon {
    type: string;

    constructor(
        public id: number,
        public resolveFunc: ResolveFunc = (field, args, contextConst, contextVar)  =>
            gqlTypesCommon.filter(this.type, contextVar)
        ) { }
}

export class ClassUser extends ClassCommon {
    constructor(
        id: number = 0,
        public name: string = '',
        public email: string = '',
        public role: string = ''
    ) {
        super(id);
        this.type = 'User';
    };
}

export const User = new ClassUser();

export class ClassChat extends ClassCommon {
    constructor(
        id: number = 0,
        public topic: string = '',
        public participants: Array<ClassUser> = [User]
    ) {
        super(id);
        this.type = 'Chat';
    }
}

export const Chat = new ClassChat();

export class ClassMessage extends ClassCommon {
    constructor(
        id: number = 0,
        public text: string = '',
        public time: string = '',
        public author: ClassUser = User,
    ) {
        super(id);
        this.type = 'Message';
    }
}

export const Message = new ClassMessage();

export class ClassChatMessage extends ClassMessage {
    constructor(
        id: number = 0,
        text: string = '',
        time: string = '',
        author: ClassUser = User,
        public chat: ClassChat = Chat
    ) {
        super(id, text, time, author);
        this.type = 'ChatMessage';
    }
}

export const ChatMessage = new ClassChatMessage();

// export class ClassChatWithMessages extends ClassChat {
//     constructor(
//         id: number = 0,
//         topic: string = '',
//         participants: Array<ClassUser> = [User],
//         public messages: Array<ClassMessage> = [Message]
//     ) {
//         super(id, topic, participants);
//         this.type = 'ChatWithMessages';
//     }
// }
//
// export const ChatWithMessages = new ClassChatWithMessages();

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};
