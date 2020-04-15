import express from 'express';
import compression from 'compression';
import cors from 'cors';
import graphqlHTTP from 'express-graphql';
import { ActionDescription, GqlProvider } from './gqlProvider';
import { ExecutionArgs, GraphQLError } from "graphql";
import { Logger } from "./logger";
import { User, ChatMessage, Chat, Role } from "./types";

(async function main() {
    const app = express();

    app.use('*', cors());
    app.use(compression());

    const logger = new Logger();
    const gqlProvider = new GqlProvider(logger);

    app.use('/graphql', graphqlHTTP({
        schema: gqlProvider.schema,
        graphiql: true,

        customExecuteFn: (args: ExecutionArgs): any =>
            gqlProvider.executeFn(args.document.definitions[0]),

        customValidateFn: (schema, documentAST, validationRules): any =>
            gqlProvider.validateFn(schema, documentAST, validationRules),

        customFormatErrorFn: (error: GraphQLError) =>
            gqlProvider.formatErrorFn(error),
    }));

    let port = 3000;
    let address = `http://localhost:${port}/graphql`;

    try {
        await app.listen(port);
        logger.log(`\n--- GraphQL is running on ${address}`);
    }
    catch (err) {
        logger.log(`\n*** Error to listen on ${address}. ${err}`)
    }

    // Settings for gqlProvider.
    // Placed after start listening for test purposes.
    // For now these are dummy functions, args are not yest provided
    gqlProvider.setResolveFunctionsForFields(
        {
            fullFieldPath: 'user',
            resolveFunc: (data, args) => {
                // const selectedUser = users[args.id];
                // data.typeObj.push(selectedUser);
                // data.resultObj.push({ type: selectedUser.type, id: selectedUser.id });
                const ad: ActionDescription = { fieldName: 'user', arrPath: ['user'], outputTypeName: 'User', isArray: false, args, children: new Array<ActionDescription>() };
                data.typeObj.push(ad);
                data.resultObj.push(ad);
                logger.log(`create Array<User>, args = ${args}`);
            }
        },
        {
            fullFieldPath: 'myChats',
            resolveFunc: (data, args) => {
                //data.typeObj.push();
                //data.resultObj.push({ type: chats[i].type, id: chats[i].id });
                const ad: ActionDescription = { fieldName: 'myChats', arrPath: ['myChats'], outputTypeName: 'Chat', isArray: true, args, children: new Array<ActionDescription>() };
                data.typeObj.push(ad);
                data.resultObj.push(ad);
                logger.log(`create Array<Chat>, args = ${args}`);
            }
        },
        // {
        //     //TEST, may be omitted
        //     fullFieldPath: 'myChats.messages.content',
        //     resolveFunc: (data, args) =>
        //         data.resultObj.content = data.typeObj.content
        // },
    );
})();

// Test Data ------------------------------------------------------------------------------------
export const users: Array<User> = [
    { type: 'User', id: 0, name: 'Julius Verne', email: 'jv@MysteriousIsland.com', role: Role.Admin },
    { type: 'User', id: 1, name: 'Cyrus Smith', email: 'cs@MysteriousIsland.com', role: Role.User },
    { type: 'User', id: 2, name: 'Gedeon Spilett', email: 'gs@MysteriousIsland.com', role: Role.User },
];

export const chatMessages: Array<ChatMessage> = [
    { type: 'ChatMessage', id: 0, content: 'aaaaaaa', time: Date.parse('2020-04-07'), author: users[0] },
    { type: 'ChatMessage', id: 1, content: 'bbbbbbb', time: Date.parse('2020-04-07'), author: users[1] },
    { type: 'ChatMessage', id: 2, content: 'ccccccc', time: Date.parse('2020-04-07'), author: users[0] },
    { type: 'ChatMessage', id: 3, content: 'ddddddd', time: Date.parse('2020-04-07'), author: users[0] },
    { type: 'ChatMessage', id: 4, content: 'eeeeeee', time: Date.parse('2020-04-07'), author: users[2] },
];

export const chats: Array<Chat> = [
    { type: 'Chat', id: 0, participants: [users[0], users[1], users[2]], messages: [chatMessages[0], chatMessages[1]] },
    { type: 'Chat', id: 1, participants: [users[1], users[0]], messages: [chatMessages[1], chatMessages[2], chatMessages[3]] },
    { type: 'Chat', id: 2, participants: [users[0], users[1]], messages: [chatMessages[4], chatMessages[1]] },
    { type: 'Chat', id: 3, participants: [users[2], users[0]], messages: [chatMessages[4], chatMessages[1], chatMessages[2]] },
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
	name
    id
  }
}

query {
  allUsers {
	role
    name
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
      name
    }
    messages {
      author {
      	name
      }
      content
    }
  }
}

*/



