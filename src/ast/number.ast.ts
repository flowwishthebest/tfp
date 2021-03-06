import { AST } from "./ast";
import { Token } from "../tokens/token";

export class NumberAST extends AST {
    constructor(private readonly _token: Token) {
        super();
    }

    public getToken(): Token {
        return this._token;
    }
}
