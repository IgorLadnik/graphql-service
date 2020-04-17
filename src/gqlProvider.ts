const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from "graphql";
import _ from 'lodash';
import { ILogger } from "./logger";
import { ValidationRule } from "graphql/validation/ValidationContext";

export interface ResolvedFieldsMap {
    [fullFieldPath: string]: Field;
}

export interface ContextMap {
    [property: string]: any;
}

export type Field = { fullFieldPath: string, type: any, resolveFunc: ResolveFunction };
export type ResolveFunction = (actionTree: any, args: any, context: any) => void;
export type FieldDescription = {
    fieldName: string,
    arrPath: Array<string>,
    outputTypeName: string,
    isArray: boolean,
    args: any,
    children: Array<FieldDescription>,
};

export class GqlProvider {
    private static readonly pathDelim = '.';

    readonly schema: any;

    private resolvedFields: ResolvedFieldsMap = { };
    private actionTree: any;
    private errors: Array<string>;

    // For recursion
    private arrPath: Array<string>;
    private args: any;
    private field: Field;
    private readonly types = Array<any>();
    private context: ContextMap;

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
        this.errors = new Array<string>();
        this.actionTree = new Array<any>();
        this.context = { };

        try {
            this.parse(obj);
        }
        catch (err) {
            this.handleError(`*** Error on executeFn: ${err}`);
        }

        let output = '';
        if (this.errors.length === 0) {
            output = GqlProvider.createOutput(this.actionTree);
            this.logger.log(GqlProvider.jsonStringifyFormatted(output));
            this.logger.log('--------------------------------------------------');

            //TODO
            // Actual data processing should be added here according to this.actionTree
            this.executeActionTree(this.actionTree);
        }
        else
            this.errors.forEach((error: string) => output += error);

        this.logger.log('--------------------------------------------------');
        return output;
    }

    // Recursive
    private parse = (currentSelection: any, prevPath: string = '') => {
        let selectionSet = currentSelection?.selectionSet;
        if (!selectionSet)
            return;

        let selections = selectionSet.selections;

        selections?.forEach((selection: any) => {
            const fieldName = selection.name.value;

            if (!GqlProvider.check({fieldName}))
                return;

            const fieldFullPath = GqlProvider.getFullFieldPath(prevPath, fieldName);
            this.args = GqlProvider.extractArguments(selection);
            this.field = this.resolvedFields[fieldFullPath];

            try {
                if (prevPath.length == 0) {
                    if (!_.isNil(this.field?.type))
                        this.setUpmostFieldType(fieldName);
                    else
                        this.handleError(`*** Error on set upmost field type for field \"${fieldName}\". ` +
                                             'Type name is not provided.');
                }
                else
                    this.setGeneralFieldType(fieldFullPath);
            } catch (err) {
                this.handleError(`*** Error on set field type for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fieldFullPath);
        });
    }

    private setUpmostFieldType = (fieldName: string) =>
        this.pushToActionTree(this.actionTree, fieldName, [fieldName], this.field.type.type, true)

    private setGeneralFieldType = (fieldFullPath: string) => {
        this.arrPath = fieldFullPath.split(GqlProvider.pathDelim);

        const depth = this.arrPath.length - 1;
        const fieldName = this.arrPath[depth];

        let parent: any;
        for (let i = 0; i < this.actionTree.length; i++)
            parent = this.getParent(this.actionTree[i]);

        if (!_.isNil(parent)) {
            const field = _.filter(this.types, t => t.type === parent.outputTypeName)[0][fieldName];
            if (!_.isNil(field)) {
                const isArray = _.isArray(field);
                const obj = isArray ? field[0] : field;
                const type = _.isNil(obj.type) ? typeof obj : obj.type;
                this.pushToActionTree(parent.children, fieldName, this.arrPath, type, isArray);
            }
            else
                this.handleError(`*** Error on set field type for field \"${fieldName}\". ` +
                                `No such field in its parent output type \"${parent.outputTypeName}\".`);
        }
    }

    private pushToActionTree = (tree: any, fieldName: string, arrPath: Array<string>, outputTypeName: string, isArray: boolean) =>
        tree.push({
            fieldName,
            arrPath,
            outputTypeName,
            isArray,
            args: this.args,
            children: new Array<FieldDescription>()
        })

    // Recursive
    private getParent = (obj: any): any => {
        if (this.isParent(obj))
            return obj;
        else
            for (let i = 0; i < obj.children.length; i++) {
                const parent = this.getParent(obj.children[i]);
                if (!_.isNil(parent))
                    return parent;
            }

        return null;
    }

    private isParent(parentCandidate: any): boolean {
        if (parentCandidate.arrPath.length + 1 !== this.arrPath.length)
            return false;

        for (let i = 0; i < parentCandidate.arrPath.length; i++)
            if (parentCandidate.arrPath[i].toLowerCase() !== this.arrPath[i].toLowerCase())
                return false;

        return true;
    }

    private static extractArguments = (selection: any): any => {
        //TODO: processing of complex args (objects) should be addressed here
        let resolveArgs: any;
        for (let i = 0; i < selection.arguments.length; i++) {
            if (i === 0)
                resolveArgs = { };
            const argument = selection.arguments[i];
            switch (argument.value.kind) {
                case 'IntValue':
                    resolveArgs[argument.name.value] = parseInt(argument.value.value);
                    break;
                case 'FloatValue':
                    resolveArgs[argument.name.value] = parseFloat(argument.value.value);
                    break;
                default:
                    resolveArgs[argument.name.value] = argument.value.value;
                    break;
            }
        }

        return resolveArgs;
    }

    setTypes = (...arrArgs: Array<any>): GqlProvider => {
        arrArgs?.forEach((args: any) => this.types.push(args));
        return this;
    }

    setResolvedFields = (...arrArgs: Array<Field>): GqlProvider => {
        arrArgs?.forEach((field: any) => this.resolvedFields[field.fullFieldPath] = field);
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

    private static createOutput = (arr: Array<any>): any => {
        switch (arr.length) {
            case 0:  return 'Empty';
            case 1:  return arr[0];
            default: return arr;
        }
    }

    private static getFullFieldPath = (prevPath: string, fieldName: string): string => {
        const prefix = prevPath.length > 0 ? `${prevPath}${GqlProvider.pathDelim}` : '';
        let temp = `${prefix}${fieldName}`;
        return temp.substr(0, temp.length);
    }

    private handleError = (errorMessage: string) => {
        this.logger.log(errorMessage);
        this.errors.push(errorMessage);
    }

    // Recursive
    private executeActionTree = (arrField: Array<any>) => {
        for (let i = 0; i < arrField.length; i++) {
            let field = arrField[i];
            let fullFieldPath = GqlProvider.composeFullFieldPath(field.arrPath);
            this.logger.log(fullFieldPath);
            const resolvedField = this.resolvedFields[fullFieldPath];
            try {
                if (!_.isNil(resolvedField))
                    resolvedField.resolveFunc(this.actionTree, field.args, this.context);
                else {
                    const type = this.findType(field);
                    if (!_.isNil(type)) {
                        if (!_.isNil(type.resolveFunc))
                            type.resolveFunc(this.actionTree, field.args, this.context);
                        else
                            this.handleError(`*** Error on resolve function execution of type \"${type.type}\". ` +
                                'This type has no resolve function.');
                    }
                    else {
                        //TODO
                        // Field's type is not in the list - most probably it is simple type (string, number, boolean)
                        this.logger.log(`simple type ${field.outputTypeName}`);
                    }
                }
            }
            catch (err) {
                this.handleError(`*** Error on resolve function execution of field \"${fullFieldPath}\". ${err}`);
            }

            this.executeActionTree(field.children);
        }
    }

    private static composeFullFieldPath = (arrPath: Array<string>): string => {
        let fullPath = '';
        for (let i = 0; i < arrPath.length; i++) {
            fullPath += arrPath[i];
            if (i < arrPath.length - 1)
                fullPath += GqlProvider.pathDelim;
        }

        return fullPath;
    }

    private findType = (field: any): any => {
        for (let i = 0; i < this.types.length; i++)
            if (this.types[i].type === field.outputTypeName)
                return this.types[i];

        return null;
    }
}
