const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from "graphql";
import _ from 'lodash';
import { ILogger } from "./logger";
import { ValidationRule } from "graphql/validation/ValidationContext";

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export type Field = { fullFieldPath: string, type: string, resolveFunc: ResolveFunction };
export type ResolveFunction = (actionTree: any, args: any) => void;
export type FieldDescription = { fieldName: string, arrPath: Array<string>, outputTypeName: string, isArray: boolean, args: any, children: Array<FieldDescription> };

export class GqlProvider {
    private static readonly pathDelim = '.';

    readonly schema: any;

    private resolveFields: ResolveFieldsMap = { };
    private actionTree: any;

    // for recursion
    private arrPath: Array<string>;
    private args: any;
    private field: Field;
    private readonly types = Array<any>();

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
        this.actionTree = new Array<any>();

        try {
            this.parse(obj);
        }
        catch (err) {
            this.logger.log(`*** Error on executeFn: ${err}`);
        }

        //TODO
        // Actual data processing should be added here according to this.actionTree

        let result = GqlProvider.createOutput(this.actionTree);

        this.logger.log(GqlProvider.jsonStringifyFormatted(result));
        this.logger.log('--------------------------------------------------');
        return result;
    }

    // Recursive
    private parse = (currentSelection: any, prevPath: string = '') => {
        let selectionSet = currentSelection?.selectionSet;
        if (!selectionSet)
            return;

        let selections = selectionSet.selections;

        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;

            if (!GqlProvider.check({fieldName}))
                return;

            const fieldFullPath = GqlProvider.getFullFieldPath(prevPath, fieldName);
            this.args = GqlProvider.extractArguments(selection);
            this.field = this.resolveFields[fieldFullPath];

            try {
                if (prevPath.length == 0) {
                    if (!_.isNil(this.field?.type))
                        this.setUpmostFieldType(fieldName);
                    else
                        this.logger.log(`*** Error on set upmost field type for field \"${fieldName}\". ` +
                                             'Type name is not provided.');
                }
                else
                    this.setGeneralFieldType(fieldFullPath);
            } catch (err) {
                this.logger.log(`*** Error on set field type for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fieldFullPath);
        }
    }

    private setUpmostFieldType = (fieldName: string) =>
        this.pushToActionTree(this.actionTree, fieldName, [fieldName], this.field.type, true)

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
        let resolveArgs: any;
        for (let i = 0; i < selection.arguments.length; i++) {
            if (i === 0)
                resolveArgs = { };
            const argument = selection.arguments[i];
            resolveArgs[argument.name.value] = parseInt(argument.value.value);
        }

        return resolveArgs;
    }

    setTypes = (...arrArgs: Array<any>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++)
            this.types.push(arrArgs[i]);

        return this;
    }

    setFieldProcessingArguments = (...arrArgs: Array<Field>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            const field = arrArgs[i];
            this.resolveFields[field.fullFieldPath] = field;
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
}
