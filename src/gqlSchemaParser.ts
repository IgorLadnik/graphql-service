import { parse, buildSchema, GraphQLSchema, GraphQLResolveInfo } from "graphql";
import { Types } from "@graphql-codegen/plugin-helpers";
import * as typescriptPlugin from "@graphql-codegen/typescript";
import { codegen } from "@graphql-codegen/core";
import { TypeScriptSimple } from "typescript-simple";
import { v4 as uuidv4 } from 'uuid';
import { CompilerOptions, ScriptTarget } from 'typescript-simple/node_modules/typescript/lib/typescript';
const path = require('path');
const fs = require('fs');
const Module = require('module');

const jsFinalCode = `
exports.jsCode = (workingDir) => {
   
   class Node {
     __typename;
     id;
     common;
     constructor(typename, id, common) {
        this.__typename = typename;
        this.id = id;
        this.common = common;
     }
   }
   
   class User extends Node {
        username;
        email;
        role;
        constructor(id, username, email, role) {
            super('User', id, '**');
            this.username = username;
            this.email = email;
            this.role = role;
        }
    };

    class Chat extends Node {
        users;
        messages;
        constructor(id, users, messages) {
            super('Chat', id, '@@');
            this.users = users;
            this.messages = messages;
        }
    };
    
    class ChatMessage extends Node {
        content;
        time;
        user;
        constructor(id, content, time, user) {
            super('ChatMessage', id, '##');
            this.content = content;
            this.time = time;
            this.user = user;
        }
    };
    
    // class QueryUserArgs {
    //     id;
    //     constructor(id) {
    //         this.id = id;
    //     }
    // };
    //
    // class QuerySearchArgs {
    //     term;
    //     constructor(term) {
    //         this.term = term;
    //     }
    // };
    
    const Role = {
        User: 'USER',
        Admin: 'ADMIN'
    };
        
    class Query {
        me;
        user;
        allUsers;
        search;
        myChats;
        constructor(me, user, allUsers, search, myChats) {
            this.me = me;
            this.user = user;
            this.allUsers = allUsers;
            this.search = search;
            this.myChats = myChats;
        }
    };
    
    return { User, Chat, ChatMessage, /*QueryUserArgs, QuerySearchArgs,*/ Role, Query };
}
`;

export type ResolverFn = (parent: any, args: any, context: any, info: GraphQLResolveInfo) => any;

export interface ResolverMap {
    [fieldName: string]: ResolverFn;
}

export class GqlSchemaParser {
    readonly schema: GraphQLSchema;
    generatedClasses: any;
    resolvers: ResolverMap = { };

    private readonly config: Types.GenerateOptions;
    private readonly strSchema: string;
    private readonly filePathWithoutExt: string;

    constructor(str: string, private isOutputToFile: boolean = false) {
        let strSchema = str;
        let interim = path.join(__dirname, '..');
        let outputDir = path.join(interim, 'output');
        let fileName: string;

        try {
            strSchema = fs.readFileSync(str, 'utf8');
            fileName = GqlSchemaParser.getFileNameWithoutExt(str);
        }
        catch {
            fileName = `${uuidv4()}`;
        }

        this.filePathWithoutExt = path.join(outputDir, fileName);

        this.strSchema = strSchema;

        this.schema = buildSchema(strSchema);
        this.config = {
            // used by a plugin internally, although the 'typescript' plugin currently
            // returns the string output, rather than writing to a file
            filename: `${this.filePathWithoutExt}.ts`,
            schema: parse(strSchema),
            plugins: [ // Each plugin should be an object
                {
                    typescript: { }, // Here you can pass configuration to the plugin
                },
            ],
            pluginMap: {
                typescript: typescriptPlugin,
                typescript_resolvers: typescriptPlugin,
            },
            documents: [],
            config: {
                //[key: string]: any;
            },
            skipDocumentsValidation: true
        };
    }

    async processSchema(): Promise<GqlSchemaParser> {
        // graphQL schema --> tsInitCode
        let code = await this.generateInitTsCode();

        // tsInitCode --> tsFinalCode
        code = this.tsPostProcessing(code);

        // tsFinalCode --> jsInitCode
        code = this.transpilation(code);

        // jsInitCode -> jsFinalCode
        code = this.jsPostProcessing(code);

        // jsCode --> generatedClasses
        this.produceGeneratedClasses(code);

        return this;
    }

    setResolvers(...arr: Array<{resolverName: string, fn: Function}>) {
        for (let i = 0;  i < arr.length; i++) {
            this.resolvers[arr[i].resolverName] = async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
                try {
                    return await arr[i].fn(parent, args, context, info);
                }
                catch (err) {
                    console.log(`ERROR in resolver \"${arr[i].resolverName}\": ${err}`);
                    return null;
                }
            }
        }
    }

    // graphQL schema --> tsInitCode
    private async generateInitTsCode(): Promise<string> {
        this.outputResultToFile('.graphql', this.strSchema);
        let outCode: string = '';
        try {
            outCode = await codegen(this.config);
            this.outputResultToFile('-init.ts', outCode);
        }
        catch (err) {
            console.log(`ERROR in \"codegen\": ${err}`);
        }

        return outCode;
    }

    // tsInitCode --> tsFinalCode
    private tsPostProcessing(code: string): string {
        let outCode: string = '';

        // Not implemented yet
        outCode = code;

        this.outputResultToFile('-final.ts', outCode);
        return outCode;
    }

    // tsFinalCode --> jsInitCode
    private transpilation(code: string): string {
        let outCode: string = '';
        const options: CompilerOptions = {
            target: ScriptTarget.ES2016,
            useDefineForClassFields: true,
            lib: ['ES6'],
            noImplicitAny: true,
            allowJs: true,
            checkJs: true
        };
        const tss = new TypeScriptSimple(options, false);

        try {
            outCode = tss.compile(code);
        }
        catch (err) {
            console.log(`ERROR in transpilation: ${err}`);
        }

        this.outputResultToFile('-init.js', outCode);
        return outCode;
    }

    // jsInitCode --> jsFinalCode
    private jsPostProcessing(code: string): string {
        let outCode: string = '';

        // Not implemented yet
        outCode = jsFinalCode;

        this.outputResultToFile('-final.js', outCode);
        return outCode;
    }

    // jsFinalCode --> generatedClasses
    private produceGeneratedClasses(code: string) {
        let m = new Module();

        try {
            m._compile(code, '');
        }
        catch (err) {
            console.log(`ERROR in module compilation: ${err}`);
        }

        try {
            this.generatedClasses = m.exports.jsCode(__dirname);
        }
        catch (err) {
            console.log(`ERROR in jsCode execution: ${err}`);
        }
    }

    private static getFileNameWithoutExt(filePath: string): string {
        let pathWitoutExt = filePath.split('.', 2)[0];
        let index = pathWitoutExt.lastIndexOf('\\');
        if (index === -1)
            index = pathWitoutExt.lastIndexOf('/');
        return pathWitoutExt.substring(index, pathWitoutExt.length);
    }

    private outputResultToFile(filePathSuffix: string, code: string) {
        if (this.isOutputToFile) {
            let filePath = `${this.filePathWithoutExt}${filePathSuffix}`;
            console.log(`\n${filePath}\n======================\n${code}\n======================\n`);
            fs.writeFileSync(filePath, code);
        }
    }
}
