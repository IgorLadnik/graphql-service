import _ from 'lodash';
import { Utils } from './utils';
import { ILogger } from '../logger';
import { IGqlProvider } from './gqlProvider';
import {ClassChat, ClassUser, User} from "../types/types";

export interface ResolvedFieldsMap {
    [fullFieldPath: string]: Field;
}

export interface ContextMap {
    [property: string]: any;
}

export type Field = {
    fullFieldPath: string,
    type?: any, // required for topmost fields only
    resolveFunc?: ResolveFunction
}

export type ResolveFunction = (field: any, args: any, contextConst: any, contextVar: any) => void;

export type FieldDescription = {
    fieldName: string,
    arrPath: Array<string>,
    typeName: string,
    isArray: boolean,
    args: any,
    children: Array<FieldDescription>,
}

export enum Operation {
    none = 0,
    query,
    mutation
}

export class GqlRequestHandler {
    contextVar: ContextMap;

    private typedFieldsTree: any;
    private errors = new Array<string>();

    // For recursion
    private arrPath: Array<string>;
    private args: any;
    private field: Field;

    private readonly logPrefix: string = `** ${this.id} **  `;

    constructor(
        private id: string,
        private gqlProvider: IGqlProvider,
        private contextConst: any,
        private logger: ILogger/*,
        private withExecution: boolean = true*/)
    {
    }

    executeFn = async (inboundObj: any): Promise<any> => {
        // Initialize appropriate variables for new query
        this.errors = new Array<string>();
        this.typedFieldsTree = new Array<any>();
        this.contextVar = { };

        this.contextVar[Utils.handlerIdPrefix] = this.logPrefix;

        let operation = Operation.none;
        let operationName: string = '';
        if (inboundObj.kind === 'OperationDefinition') {
            operation = GqlRequestHandler.getOperation(inboundObj.operation);
            operationName = inboundObj.name?.value;
        }

        // Parsing inbound query to obtain "this.typedFieldsTree"
        try {
            this.makeTypedFieldsTree(inboundObj);
        }
        catch (err) {
            this.handleError(`*** Error on executeFn: ${err}`);
        }

        let output: any;
        const results = new Array<any>();
        if (this.isErrorsFree()) {
            this.log('-- Action Tree -----------------------------------');
            this.log(`${GqlRequestHandler.jsonStringifyFormatted(this.createTypedFieldsTreeOutput())}`);

            // Actual data processing according to this.actionTree
            this.log('-- Execution Trace -------------------------------');
            try {
                await this.execute(this.typedFieldsTree);
            }
            catch (err) {
                this.handleError(`*** Error on executeActionTree: ${err}`);
            }

            if (this.isErrorsFree()) {
                this.typedFieldsTree.forEach((item: any) => {
                    let a = this.contextVar[item.fieldName];
                    if (operation === Operation.query)
                        a = a[0][0];

                    results.push(a)
                });

                output = this.createOutput(results, operationName?.length > 0 ? operationName : 'data');
            }
        }

        if (this.isErrorsFree()) {
            this.log('-- Execution Result ------------------------------');
            this.log(`${GqlRequestHandler.jsonStringifyFormatted(output)}`);
        }
        else {
            // Errors
            let strErrors = 'Errors:';
            this.errors.forEach((error: string) => strErrors += `\n- ${error}`);
            this.log('-- Errors ----------------------------------------');
            this.log(`${strErrors}`);
            output = this.errors;
        }

        this.log('--------------------------------------------------');
        return output;
    }

    // Recursive parsing
    private makeTypedFieldsTree = (currentSelection: any, prevPath: string = '') => {
        let selectionSet = currentSelection?.selectionSet;
        if (!selectionSet)
            return;

        let selections = selectionSet.selections;

        selections?.forEach((selection: any) => {
            const fieldName = selection.name.value;

            if (!GqlRequestHandler.check({fieldName}))
                return;

            const fullFieldPath = GqlRequestHandler.getFullFieldPath(prevPath, fieldName);
            this.args = GqlRequestHandler.extractArguments(selection);
            this.field = this.gqlProvider.resolvedFields[fullFieldPath];

            try {
                if (prevPath.length == 0) {
                    if (!_.isNil(this.field?.type))
                        this.setUpmostFieldType();
                    else
                        this.handleError('*** Error on set upmost field type for field ' +
                                             `\"${fieldName}\". ` +
                                             'Type name is not provided.');
                }
                else
                    this.setGeneralFieldType(fullFieldPath);
            }
            catch (err) {
                this.handleError(`*** Error on set field type for field \"${fieldName}\". ${err}`);
                return;
            }

            this.makeTypedFieldsTree(selection, fullFieldPath);
        });
    }

    private setUpmostFieldType = () => {
        let type = this.field.type;
        let isArray = _.isArray(type);
        if (isArray)
            type = type[0];
        let fieldName = this.field.fullFieldPath;
        this.pushToActionTree(this.typedFieldsTree, fieldName, [fieldName], type.type, isArray);
    }

    private setGeneralFieldType = (fullFieldPath: string) => {
        this.arrPath = fullFieldPath.split(Utils.pathDelim);

        const level = this.arrPath.length - 1;
        const fieldName = this.arrPath[level];

        let parent: any;
        for (let i = 0; i < this.typedFieldsTree.length; i++)
            parent = this.getParent(this.typedFieldsTree[i]);

        if (!_.isNil(parent)) {
            const field = _.filter(this.gqlProvider.types, t => t.type === parent.typeName)[0][fieldName];
            if (!_.isNil(field)) {
                const isArray = _.isArray(field);
                const obj = isArray ? field[0] : field;
                const type = GqlRequestHandler.getObjType(obj);
                this.pushToActionTree(parent.children, fieldName, this.arrPath, type, isArray);
            }
            else
                this.handleError(`*** Error on set field type for field \"${fieldName}\". ` +
                                `No such field in its parent output type \"${parent.typeName}\".`);
        }
    }

    private pushToActionTree = (tree: any, fieldName: string, arrPath: Array<string>,
                                typeName: string, isArray: boolean) =>
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

    static jsonStringifyFormatted = (obj: any): string =>
        //JSON.stringify(jsObj, null, "\t"); // stringify with tabs inserted at each level
        //JSON.stringify(jsObj, null, 4);    // stringify with 4 spaces at each level
        JSON.stringify(obj, null, '\t')

    private createTypedFieldsTreeOutput = (): any => {
        const arr = this.typedFieldsTree;
        const outerObjectName = 'typed_fields_tree';
        let data: any = { };
        switch (arr.length) {
            case 0:  return 'Empty';
            case 1:  data = arr[0]; break;
            default: data = arr; break;
        }

        return { [outerObjectName]: data };
    }

    private createOutput = (arr: Array<any>, outerObjectName: string): any => {
        let data: any = { };
        if (this.gqlProvider.withSchema) {
            const item = arr[0];
            const propName = Object.keys(item)[0];
            data = item[propName];
        }
        else
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                const propName = Object.keys(item)[0];
                data[propName] = item[propName];
            }

        return data;
    }

    private static getFullFieldPath = (prevPath: string, fieldName: string): string => {
        const prefix = prevPath.length > 0 ? `${prevPath}${Utils.pathDelim}` : '';
        let temp = `${prefix}${fieldName}`;
        return temp.substr(0, temp.length);
    }

    private handleError = (errorMessage: string) => {
        this.log(`${errorMessage}`);
        this.errors.push(errorMessage);
    }

    // Recursive
    private execute = async (treeItem: Array<any>) => {
        for (let i = 0; i < treeItem.length; i++) {
            let field = treeItem[i];
            let fullFieldPath = Utils.composeFullFieldPath(field.arrPath);
            this.log(`${fullFieldPath}`);
            const resolvedField = this.gqlProvider.resolvedFields[fullFieldPath];
            try {
                if (!_.isNil(resolvedField)) {
                    // The field is explicitly registered as Resolved Field
                    if (!_.isNil(resolvedField.resolveFunc))
                        // Resolved Field has definition for ResolveFunc
                        await resolvedField.resolveFunc(field, field.args, this.contextConst, this.contextVar);
                    else
                        // Resolved Field has NOT definition for ResolveFunc.
                        // Implicit resolve function based on naming convention is used.
                        await this.gqlProvider.resolveFunc(fullFieldPath,
                                                        field, field.args, this.contextConst, this.contextVar);
                }
                else {
                    // The field is NOT explicitly registered as Resolved Field
                    if (! await this.gqlProvider.resolveFunc(fullFieldPath,
                                                field, field.args, this.contextConst, this.contextVar)) {
                        // No implicit resolve function for registered for given "fullFieldPath"
                        const type = this.gqlProvider.findRegisteredType(field.typeName);
                        if (!_.isNil(type)) {
                            // Field's type is registered - it should be a complex type
                            if (!_.isNil(type.resolveFunc))
                                await type.resolveFunc(this.typedFieldsTree, field.args, this.contextConst,
                                                       this.contextVar);
                            else
                                this.handleError('*** Error on resolve function execution of type ' +
                                    `\"${type.type}\". ` +
                                    `Type \"${type.type}\" has no resolve function.`);
                        }
                        else {
                            // Field's type is NOT registered - it should be a simple type (string, number, boolean)
                            if (GqlRequestHandler.isSimpleType(field.typeName))
                                this.log(`simple type ${field.typeName}`); //??
                            else
                                this.handleError('*** Error on resolve function execution of type '+
                                    `\"${field.typeName}\". ` +
                                    `Type \"${field.typeName}\" is not registered.`);
                        }
                    }
                }
            }
            catch (err) {
                this.handleError('*** Error on resolve function execution of field ' +
                                            `\"${fullFieldPath}\". ${err}`);
            }

            await this.execute(field.children);
        }
    }

    private static isSimpleType = (typeName: string): boolean =>
        ['string', 'number', 'boolean'].includes(typeName);

    isErrorsFree = (): boolean =>
        this.errors.length === 0;

    private static getOperation = (strOperation: string): Operation => {
        switch (strOperation) {
            case 'query': return Operation.query;
            case 'mutation': return Operation.mutation;
            default:  return Operation.none;
        }
    }

    private log = (message: string) =>
        this.logger.log(`${this.logPrefix}${message}`);
}
