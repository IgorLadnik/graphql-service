import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import {DataMap, GqlProvider} from './gqlProvider';
import { ExecutionArgs, GraphQLError } from "graphql";
import _ from 'lodash';

(async function main() {
    const app = express();

    app.use('*', cors());
    app.use(compression());

    const gqlProvider = new GqlProvider();

    app.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,
        graphiql: true,

        customExecuteFn: (args: ExecutionArgs): any =>
            gqlProvider.executeFn(args.document.definitions[0]),

        customValidateFn: (schema, documentAST, validationRules): any =>
            true,

        customFormatErrorFn: (error: GraphQLError) =>
            console.log('customFormatErrorFn')
    }));

    let port = 3000;
    let address = `http://localhost:${port}/graphql`;

    try {
        await app.listen(port);
        console.log(`\n--- GraphQL is running on ${address}`);
    }
    catch (err) {
        console.log(`\n*** Error to listen on ${address}. ${err}`)
    }

    // Settings for gqlProvider.
    // Placed after start listening for test purposes.
    // For now these are dummy functions, args are not yest provided
    gqlProvider.setResolveFunctionsForFields(
        {
            name: 'user',
            fn: (parent, args) => {
                let result = { a: new Array<any>(), c: new Array<any>() };
                const selectedUser = users[args.id];
                result.a.push(selectedUser);
                result.c.push({ name: selectedUser.name, id: selectedUser.id });
                return result;
            }
        },
        {
            name: 'myChats',
            fn: (parent, args) => {
                let result = { a: new Array<any>(), c: new Array<any>() };
                for (let i = 0; i < 2; i++) {
                    result.a.push(chats[i]);
                    result.c.push({ name: chats[i].name, id: chats[i].id });
                }
                return result;
            }
        },
        {
            name: 'participants',
            fn: (parent, args) => GqlProvider.resolver1('participants', parent, args)   //TEMP
        },
        {
            name: 'messages',
            fn: (parent, args) => GqlProvider.resolver1('messages', parent, args)       //TEMP
        },
        {
            name: 'author',
            fn: (parent, args) => {
                const fieldName = 'author';
                const result = { a: new Array<any>(), c: new Array<any>() };
                // for (let i = 0; i < parent.c.length; i++) {
                //     const a = parent.a[i];
                //     const c = parent.c[i];

                    // c.messages = new Array<any>();
                    // for (let j = 0; j < a.participants.length; j++) {
                    //     const t = a.participants[j];
                    //     c.messages.push({ name: t.name, id: t.id });
                    // }
                //}
                // for (let i = 0; i < data.actual.length; i++)
                //     for (let j = 0; j < data.actual.length; j++)
                //         data.constructed[i].messages[j].author = data.actual[i].messages[j].author;
                return result;
            }
        },
    );
})();

export const Role = {
    User: 'USER',
    Admin: 'ADMIN'
};

// Test Data ------------------------------------------------------------------------------------
export const users = [
    { name: 'User', id: 0, username: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: Role.Admin },
    { name: 'User', id: 1, username: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: Role.User },
    { name: 'User', id: 2, username: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: Role.User },
];

export const chatMessages = [
    { name: 'ChatMessage', id: 0, content: 'aaaaaaa', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: 1, content: 'bbbbbbb', time: Date.parse('2020-04-07'), author: users[1] },
    { name: 'ChatMessage', id: 2, content: 'ccccccc', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: 3, content: 'ddddddd', time: Date.parse('2020-04-07'), author: users[0] },
    { name: 'ChatMessage', id: 4, content: 'eeeeeee', time: Date.parse('2020-04-07'), author: users[2] },
];

export const chats = [
    { name: 'Chat', id: 0, participants: [users[0], users[1], users[2]], messages: [chatMessages[0], chatMessages[1]] },
    { name: 'Chat', id: 1, participants: [users[1], users[0]], messages: [chatMessages[1], chatMessages[2], chatMessages[3]] },
    { name: 'Chat', id: 2, participants: [users[0], users[1]], messages: [chatMessages[4], chatMessages[1]] },
    { name: 'Chat', id: 3, participants: [users[2], users[0]], messages: [chatMessages[4], chatMessages[1], chatMessages[2]] },
];
// -----------------------------------------------------------------------------------------

/* Queries

query {
  me {
	id
    email
  }
}

query {
  user(id: 1) {
	username
    id
  }
}

query {
  allUsers {
	role
    username
    id
  }
}

query {
  search(term: "Users") {
	id
    email
  }
}

query {
  myChats {
		id
    participants {
      username
    }
    messages {
      author {
      	username
    	}
      content
    }
  }
}

*/



