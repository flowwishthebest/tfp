import { ASTVisitor } from "./ast-visitor"
import { ScopedSymbolTable } from "./scoped-symbol-table"
import { ProcedureSymbol,VariableSymbol } from "./symbols";
import {
    BinOpAST,
    UnaryOpAST,
    CompoundAST,
    AssignAST,
    VariableAST,
    VariableDeclarationAST,
    ProcedureDeclarationAST,
    ProgramAST,
    BlockAST,
 } from "./ast";
import { EErrorType } from "./types/error.type";
import { SemanticAnalyzerError } from "./errors/semantic-analyzer.error";
import { Token } from "./tokens/token";
import { ProcedureCallAST } from "./ast/procedure-call.ast";
import { IfAST } from "./ast/if.ast";
import { WhileAST } from "./ast/while.ast";
import { VarDeclAST } from "./ast/var-decl.ast";
import { ProgAST } from "./ast/prog.ast";

interface KwArgs {
    shouldLogScope?: boolean;
    logger?: any;
}

const DUPLICATE_ID_MESSAGE = (token: Token): string =>
    `${EErrorType.DUPLICATE_ID} -> ${token.toString()}`;

const ID_NOT_FOUND_MESSAGE = (token: Token): string =>
    `${EErrorType.ID_NOT_FOUND} -> ${token.toString()}`;

const WRONG_NUMS_ARGS_MESSAGE = (token: Token): string =>
    `${EErrorType.WRONG_NUMEBER_OF_ARGS} -> ${token.toString()}`;

const defaultOpts = {
    shouldLogScope: false,
} as KwArgs;

export class SemanticAnalyzer extends ASTVisitor {

    private _scope: ScopedSymbolTable;
    private _logScope: boolean;
    private _logger: any;

    constructor(kwArgs: KwArgs = defaultOpts) {
        super();

        this._scope = null;
        this._logScope = kwArgs.shouldLogScope;
        this._logger = kwArgs.logger || console;
    }

    public visitBlockAST(node: BlockAST): void {
        node.getDeclarations()
            .forEach((declaration) => this.visit(declaration));

        this.visit(node.getCompoundStatement());
    }

    public visitProgramAST(node: ProgramAST): void {
        const globalScope = new ScopedSymbolTable({
            scopeName: 'global',
            scopeLevel: 1,
            enclosingScope: this._scope, // will be null,
            initBuiltins: true,
        });

        this._scope = globalScope;

        this._log(`Enter scope: <${this._scope.getScopeName()}>`);

        this.visit(node.getBlock());

        globalScope.print();

        this._log(`Leave scope: <${this._scope.getScopeName()}>`);

        this._scope = this._scope.getEnclosingScope();
    }

    public visitProgAST(node: ProgAST): void {
        const globalScope = new ScopedSymbolTable({
            scopeName: 'glob',
            scopeLevel: 1,
            enclosingScope: this._scope,
            initBuiltins: true,
        });

        this._scope = globalScope;

        this._log(`Enter scope: <${this._scope.getScopeName()}>`);

        for (const stmt of node.getStatements()) {
            this.visit(stmt);
        }

        globalScope.print();

        this._log(`Leave scope: <${this._scope.getScopeName()}>`);

        this._scope = this._scope.getEnclosingScope();
    }

    public visitBinOpAST(node: BinOpAST): void {
        this.visit(node.getLeft());
        this.visit(node.getRight());
    }

    public visitNumberAST(/* node: NumberAST */): void {
        // TODO:
        return;
    }

    public visitUnaryOpAST(node: UnaryOpAST): void {
        this.visit(node.getRight());
    }

    public visitCompoundAST(node: CompoundAST): void {
        node.getChildren().forEach((c) => this.visit(c));
    }

    public visitEmptyAST(/* node: EmptyAST */): void {
        // TODO:
        return;
    }

    public visitVariableDeclarationAST(node: VariableDeclarationAST): void {
        const typeName = node.getType().getToken().getValue();

        const typeSymbol = this._scope.lookup(typeName);

        const varName = node.getVariable().getName();

        const variableSymbol = new VariableSymbol(varName, typeSymbol);

        if (this._scope.lookup(varName, { currentScopeOnly: true })) {
            this._throw(
                DUPLICATE_ID_MESSAGE(node.getVariable().getToken()),
                EErrorType.DUPLICATE_ID,
                node.getVariable().getToken(),
            );
        }

        this._scope.define(variableSymbol);
    }
    
    public visitVarDeclAST(node: VarDeclAST): void {
        const typeName = 'any';

        const typeSymbol = this._scope.lookup(typeName);

        const varName = node.getName();

        node.getInitializer() && this.visit(node.getInitializer());

        const variableSymbol = new VariableSymbol(varName, typeSymbol);

        if (this._scope.lookup(varName, { currentScopeOnly: true })) {
            const token = node.getToken();

            this._throw(
                DUPLICATE_ID_MESSAGE(token),
                EErrorType.DUPLICATE_ID,
                token,
            );
        }

        this._scope.define(variableSymbol);
    }

    public visitAssignAST(node: AssignAST): void | never {
        const varName = node.getLeft().getToken().getValue();
        const varSymbol = this._scope.lookup(varName);

        if (!varSymbol) {
            this._throw(
                ID_NOT_FOUND_MESSAGE(node.getLeft().getToken()),
                EErrorType.ID_NOT_FOUND,
                node.getLeft().getToken(),
            )
        }
    
        this.visit(node.getRight());
    }

    public visitVariableAST(node: VariableAST): void {
        const varName = node.getToken().getValue();

        const varSymbol = this._scope.lookup(varName);
    
        if (!varSymbol) {
            throw new Error(`Symbol (Indentifier) not found <${varName}>`); 
        }
    }

    public visitProcedureDeclarationAST(node: ProcedureDeclarationAST): void {
        const procedureName = node.getName().getValue(); // TODO: api fix
        const procedureSymbol = new ProcedureSymbol(procedureName);

        this._scope.define(procedureSymbol);

        const procedureScope = new ScopedSymbolTable({
            scopeName: procedureName,
            scopeLevel: this._scope.getScopeLevel() + 1,
            enclosingScope: this._scope,
        });

        this._scope = procedureScope;

        this._log(`Enter scope: <${this._scope.getScopeName()}>`);

        node.getParameters().forEach((param) => {
            const type = param.getTypeNode().getToken().getValue();

            const paramType = this._scope.lookup(type);

            const paramName = param.getVarNode().getToken().getValue();

            const varSymbol = new VariableSymbol(paramName, paramType);

            this._scope.define(varSymbol);

            procedureSymbol.getParams().push(varSymbol);
        });

        this.visit(node.getBlock());

        procedureScope.print();

        this._log(`Leave scope: <${this._scope.getScopeName()}>`);

        procedureSymbol.setBlock(node.getBlock());

        this._scope = this._scope.getEnclosingScope();
    }

    public visitProcedureCallAST(node: ProcedureCallAST): void {
        const proc = this._scope.lookup(node.getProcedureName()) as ProcedureSymbol;

        const declaredParams = proc.getParams();
        const callParams = node.getParams();

        if (declaredParams.length !== callParams.length) {
            this._throw(
                WRONG_NUMS_ARGS_MESSAGE(node.getToken()),
                EErrorType.WRONG_NUMEBER_OF_ARGS,
                node.getToken(),
            );
        }
        node.getParams().forEach((p) => this.visit(p));
        node.setProcedureSymbol(proc);
    }

    public visitIfAST(node: IfAST): void {
        this.visit(node.getCondition());
        this.visit(node.getIfPart());
        
        if (node.getElsePart()) {
            this.visit(node.getElsePart());
        }
    }

    public visitWhileAST(node: WhileAST): void {
        this.visit(node.getCondition());
        this.visit(node.getBody());
    }

    private _throw(msg: string, errType: EErrorType, token: Token): never {
        throw new SemanticAnalyzerError(msg, errType, token);
    }

    private _log(msg: string): void {
        if (this._logScope) {
            this._logger.log(msg);
        }
    }

    private _declarare(name: Token): void {
        if (!this._scope) {
            return;
        }

        this._scope.define(
            new VariableSymbol(name.getValue(), this._scope.lookup('any')),
        );
    }
}
