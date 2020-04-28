const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from 'graphql';
import _ from 'lodash';
import { ILogger } from '../logger';
import { ValidationRule } from 'graphql/validation/ValidationContext';

export interface ResolvedFieldsMap {
    [fullFieldPath: string]: Field;
}

export interface ContextMap {
    [property: string]: any;
}

export type Field = {
    fullFieldPath: string,
    type?: any, // required for topmost fields only
    resolveFunc: ResolveFunction };

export type ResolveFunction = (field: any, args: any, contextConst: any, contextVar: any) => void;

export type FieldDescription = {
    fieldName: string,
    arrPath: Array<string>,
    typeName: string,
    isArray: boolean,
    args: any,
    children: Array<FieldDescription>,
};

export interface IGqlProvider {
    findRegisteredType(typeName: string): any;
}

export class GqlProvider implements IGqlProvider {
    private static readonly pathDelim = '.';

    readonly schema: any;
    contextConst: ContextMap = { };
    contextVar: ContextMap;

    private resolvedFields: ResolvedFieldsMap = { };
    private actionTree: any;
    private errors = new Array<string>();

    // For recursion
    private arrPath: Array<string>;
    private args: any;
    private field: Field;
    private readonly types = Array<any>();

    constructor(private logger: ILogger, private withExecution: boolean = true) {
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

    executeFn = async (inboundObj: any): Promise<string> => {
        // Initialize appropriate variables for new query
        this.errors = new Array<string>();
        this.actionTree = new Array<any>();
        this.contextVar = { };

        // Parsing inbound query to obtain "this.actionTree"
        try {
            this.parse(inboundObj);
        }
        catch (err) {
            this.handleError(`*** Error on executeFn: ${err}`);
        }

        let output: any;
        const results = new Array<any>();
        if (this.isErrorsFree()) {
            this.logger.log('-- Action Tree -----------------------------------');
            output = GqlProvider.createOutput(this.actionTree, 'action_tree');
            this.logger.log(GqlProvider.jsonStringifyFormatted(output));

            if (this.withExecution) {
                // Actual data processing according to this.actionTree
                this.logger.log('-- Execution Trace -------------------------------');
                try {
                    await this.executeActionTree(this.actionTree);
                }
                catch (err) {
                    this.handleError(`*** Error on executeActionTree: ${err}`);
                }

                if (this.isErrorsFree()) {
                    this.actionTree.forEach((item: any) => results.push(this.contextVar[`${item.fieldName}`][0][0]));
                    output = GqlProvider.createOutput(results, 'data');
                }
            }
        }

        if (this.isErrorsFree()) {
            this.logger.log('-- Execution Result ------------------------------');
            this.logger.log(GqlProvider.jsonStringifyFormatted(output));
        }
        else {
            // Errors
            let strErrors = 'Errors:';
            this.errors.forEach((error: string) => strErrors += `\n- ${error}`);
            this.logger.log('-- Errors ----------------------------------------');
            this.logger.log(strErrors);
            output = this.errors;
        }

        this.logger.log('--------------------------------------------------');
        return output;
    }

    registerTypes = (...arrArgs: Array<any>): GqlProvider => {
        arrArgs?.forEach((args: any) => this.types.push(args));
        return this;
    }

    registerResolvedFields = (...arrArgs: Array<Field>): GqlProvider => {
        arrArgs?.forEach((field: any) => this.resolvedFields[field.fullFieldPath] = field);
        return this;
    }

    // Recursive parsing
    private parse = (currentSelection: any, prevPath: string = '') => {
        let selectionSet = currentSelection?.selectionSet;
        if (!selectionSet)
            return;

        let selections = selectionSet.selections;

        selections?.forEach((selection: any) => {
            const fieldName = selection.name.value;

            if (!GqlProvider.check({fieldName}))
                return;

            const fullFieldPath = GqlProvider.getFullFieldPath(prevPath, fieldName);
            this.args = GqlProvider.extractArguments(selection);
            this.field = this.resolvedFields[fullFieldPath];

            try {
                if (prevPath.length == 0) {
                    if (!_.isNil(this.field?.type))
                        this.setUpmostFieldType();
                    else
                        this.handleError(`*** Error on set upmost field type for field \"${fieldName}\". ` +
                                             'Type name is not provided.');
                }
                else
                    this.setGeneralFieldType(fullFieldPath);
            }
            catch (err) {
                this.handleError(`*** Error on set field type for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fullFieldPath);
        });
    }

    private setUpmostFieldType = () => {
        let type = this.field.type;
        let isArray = _.isArray(type);
        if (isArray)
            type = type[0];
        let fieldName = this.field.fullFieldPath;
        this.pushToActionTree(this.actionTree, fieldName, [fieldName], type.type, isArray);
    }

    private setGeneralFieldType = (fullFieldPath: string) => {
        this.arrPath = fullFieldPath.split(GqlProvider.pathDelim);

        const level = this.arrPath.length - 1;
        const fieldName = this.arrPath[level];

        let parent: any;
        for (let i = 0; i < this.actionTree.length; i++)
            parent = this.getParent(this.actionTree[i]);

        if (!_.isNil(parent)) {
            const field = _.filter(this.types, t => t.type === parent.typeName)[0][fieldName];
            if (!_.isNil(field)) {
                const isArray = _.isArray(field);
                const obj = isArray ? field[0] : field;
                const type = GqlProvider.getObjType(obj);
                this.pushToActionTree(parent.children, fieldName, this.arrPath, type, isArray);
            }
            else
                this.handleError(`*** Error on set field type for field \"${fieldName}\". ` +
                                `No such field in its parent output type \"${parent.typeName}\".`);
        }
    }

    private pushToActionTree = (tree: any, fieldName: string, arrPath: Array<string>, typeName: string, isArray: boolean) =>
        tree.push({
            fieldName,
            arrPath,
            typeName,
            isArray,
            args: this.args,
            children: new Array<FieldDescription>()
        })

    private static getObjType = (obj: any): string =>
        _.isNil(obj.type) ? typeof(obj) : obj.type;

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

    private static check = (checkData: any): boolean => {
        if (checkData.fieldName === '__schema')
            return false;

        return true;
    }

    private static jsonStringifyFormatted = (obj: any): string =>
        //JSON.stringify(jsObj, null, "\t"); // stringify with tabs inserted at each level
        //JSON.stringify(jsObj, null, 4);    // stringify with 4 spaces at each level
        JSON.stringify(obj, null, '\t')

    private static createOutput = (arr: Array<any>, outerObjectName: string): any => {
        let data: any = { };
        switch (arr.length) {
            case 0:  return 'Empty';
            case 1:  data = arr[0]; break;
            default: data = arr; break;
        }

        return { [outerObjectName]: data };
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
    private executeActionTree = async (actionTreeItem: Array<any>) => {
        for (let i = 0; i < actionTreeItem.length; i++) {
            let field = actionTreeItem[i];
            let fullFieldPath = GqlProvider.composeFullFieldPath(field.arrPath);
            this.logger.log(fullFieldPath);
            const resolvedField = this.resolvedFields[fullFieldPath];
            try {
                if (!_.isNil(resolvedField))
                    await resolvedField.resolveFunc(field, field.args, this.contextConst, this.contextVar);
                else {
                    const type = this.findRegisteredType(field.typeName);
                    if (!_.isNil(type)) {
                        if (!_.isNil(type.resolveFunc))
                            await type.resolveFunc(this.actionTree, field.args, this.contextConst, this.contextVar);
                        else
                            this.handleError(`*** Error on resolve function execution of type \"${type.type}\". ` +
                                `Type \"${type.type}\" has no resolve function.`);
                    }
                    else {
                        if (GqlProvider.isSimpleType(field.typeName)) {
                            //TODO
                            // Field's type is not in the list - most probably it is simple type (string, number, boolean)
                            this.logger.log(`simple type ${field.typeName}`);
                        }
                        else
                            this.handleError(`*** Error on resolve function execution of type \"${field.typeName}\". ` +
                                `Type \"${field.typeName}\" is not registered.`);
                    }
                }
            }
            catch (err) {
                this.handleError(`*** Error on resolve function execution of field \"${fullFieldPath}\". ${err}`);
            }

            await this.executeActionTree(field.children);
        }
    }

    static composeFullFieldPath = (arrPath: Array<string>): string =>
        arrPath.reduce((a, c) => a + `${GqlProvider.pathDelim}${c}`)

    findRegisteredType = (typeName: string): any => {
        for (let i = 0; i < this.types.length; i++)
            if (this.types[i].type === typeName)
                return this.types[i];

        return null;
    }

    private static isSimpleType = (typeName: string): boolean =>
        ['string', 'number', 'boolean'].includes(typeName);

    isErrorsFree = (): boolean =>
        this.errors.length === 0;
}
