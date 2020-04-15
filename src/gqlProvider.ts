const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from "graphql";
import _ from 'lodash';
import { ILogger } from "./logger";
import { ValidationRule } from "graphql/validation/ValidationContext";

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export type Field = { fieldName: string, resolveFunc: ResolveFunction };
export type ResolveFunction = (data: Data, args: any, fieldFullPath: string) => void;
export type Data = { typeObj: any, resultObj: any };

export class GqlProvider {
    readonly schema: any;

    private resolveFields: ResolveFieldsMap = { };
    private data: Data;

    // for recursion
    private arrPath: Array<string>;

    constructor(private logger: ILogger) {
        const config = new GraphQLObjectType({ name: 'Query' }).toConfig();
        config.fields['_'] = GqlProvider.createFreshDummyField();
        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(config) });
    }

    private static createFreshDummyField = () => {
        const dummyField = new GraphQLObjectType({name: '_', fields: {dummy: {}}}).toConfig().fields.dummy;
        dummyField.type = new GraphQLObjectType({
            name: '_',
            fields: () => ({
                id: { type: GraphQLID },
            })
        });
        return dummyField;
    }

    validateFn = (schema: any, documentAST: DocumentNode, rules: ReadonlyArray<ValidationRule>) => true;

    formatErrorFn = (error: GraphQLError) => this.logger.log(`*** Error: ${error}`);

    executeFn = (obj: any): string => {
        this.logger.log('--------------------------------------------------');
        this.data = { typeObj: new Array<any>(), resultObj: new Array<any>() };
        
        try {
            this.parse(obj);
        }
        catch (err) {
            this.logger.log(`*** Error on executeFn: ${err}`);
        }

        this.logger.log(GqlProvider.jsonStringifyFormatted(this.data.resultObj));
        this.logger.log('--------------------------------------------------');
        return this.createOutput();
    }

    // Recursive
    private parse = (upperSelection: any, prevPath: string = '') => {
        let selectionSet = upperSelection?.selectionSet;
        if (!selectionSet)
            return Array<any>();

        let selections = selectionSet.selections;

        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;

            if (!GqlProvider.check({fieldName}))
                return;

            const fieldFullPath = `${prevPath}.${fieldName}`;
            const args = GqlProvider.extractArguments(selection);
            const field = this.resolveFields[fieldName];

            try {
                if (_.isFunction(field?.resolveFunc))
                    field.resolveFunc(this.data, args, fieldFullPath);
                else
                    this.generalResolveFunc(this.data, fieldFullPath);
            } catch (err) {
                this.logger.log(`*** Error on call of resolve function for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fieldFullPath);
        }
    }

    generalResolveFunc = (data: Data, fieldFullPath: string) => {
        this.arrPath = GqlProvider.splitFullFieldPath(fieldFullPath);
        this.recursiveResolveFuncInner(data.typeObj, data.resultObj, 1);
    }

    private recursiveResolveFuncInner = (typeObj: any, resultObj: any, depth: number) => {
        const maxDepth = this.arrPath.length - 1;
        const fieldName = this.arrPath[depth];

        if (_.isArray(typeObj))
            for (let i = 0; i < typeObj.length; i++)
                this.recursiveResolveFuncInner(typeObj[i], resultObj[i], depth);
        else
            if (_.isNil(typeObj[fieldName]))
                this.recursiveResolveFuncInner(typeObj, resultObj, depth);
            else
                if (depth == maxDepth)
                    // action
                    GqlProvider.fillresultObj(typeObj, resultObj, fieldName);
                else
                    this.recursiveResolveFuncInner(typeObj[fieldName], resultObj[fieldName], depth + 1);
    }

    private static fillresultObj = (typeObj: any, resultObj: any, fieldName: string) => {
        if (_.isArray(typeObj[fieldName])) {
            resultObj[fieldName] = new Array<any>();
            for (let i = 0; i < typeObj[fieldName].length; i++)
                resultObj[fieldName].push({  });
        }
        else
            resultObj[fieldName] = _.isNil(typeObj[fieldName].id)
                ? /* simple */  typeObj[fieldName]
                : /* complex */ {  };
    }

    private static extractArguments = (selection: any): any => {
        let resolveArgs: any;
        for (let i = 0; i < selection.arguments.length; i++) {
            if (i === 0)
                resolveArgs = { };
            const argument = selection.arguments[i];
            resolveArgs[argument.name.value] = parseInt(argument.value.value);
        }

        return resolveArgs;
    }

    setResolveFunctionsForFields = (...arrArgs: Array<Field>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            const field = arrArgs[i];
            this.resolveFields[field.fieldName] = field;
        }

        return this;
    }

    private static check = (checkData: any): boolean => {
        if (checkData.fieldName === '__schema')
            return false;

        return true;
    }

    private static jsonStringifyFormatted = (obj: any): string =>
        //JSON.stringify(jsObj, null, "\t"); // stringify with tabs inserted at each level
        //JSON.stringify(jsObj, null, 4);    // stringify with 4 spaces at each level
        JSON.stringify(obj, null, '\t')

    private createOutput = (): any =>
        this.data.resultObj.length > 0
            ? this.data.resultObj
            : '???';

    private static splitFullFieldPath = (fieldFullPath: string): Array<string> =>
        fieldFullPath.substr(1, fieldFullPath.length - 1).split('.');
}