import { ILogger } from "./logger";

export class TypesCommon {
    constructor(private logger: ILogger) { }

    filter = (typeName: string, contextVar: any) => {
        const strData = `${typeName}_data`;
        const strProperties = `${typeName}_properties`;
        let inItem = contextVar[strData];
        const outItem: any = { };
        contextVar[strProperties].forEach((p: string) => outItem[p] = inItem[p]);
        contextVar[strData] = outItem;
        this.logger.log('resolve() for type ${typeName}');
    }
}
