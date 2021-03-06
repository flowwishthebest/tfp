import { AST } from "./ast";

export class ProgAST extends AST {

    constructor(
        private readonly _statements: Array<AST> = [],
    ) {
        super();
    }

    public getStatements(): Array<AST> {
        return this._statements;
    }
}
