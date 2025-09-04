const PREC = {
  POSTFIX: 9,
  POWER: 8,
  UNARY: 7,
  MULT: 6,
  ADD: 5,
  COMP: 4,
};

module.exports = grammar({
  name: "wq",

  // Newlines are significant, thus not included
  extras: ($) => [/[ \t\r]/, $.comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    // [$.postfix, $.primary],
    [$.literal, $.dict_body],
    // Ambiguity between parsing as an expression vs lvalue before ':'
  ],

  rules: {
    // Allow an optional shebang followed by an arbitrary interleave of statements and separators
    source_file: ($) =>
      seq(optional($.shebang), repeat(choice($.statement, $.sep_unit))),

    magic_command: ($) => token(seq("!", /[^\n]*/)),

    // separators
    // ==========
    // Atomic separator unit: either ';' or one+ newlines
    sep_unit: ($) => choice(";", $.newline),
    // one-or-more helper to avoid "repeat of repeat" conflicts
    seps: ($) => prec.left(repeat1($.sep_unit)),

    // program structure
    // =================
    // statements: statement (seps statement)* [seps]
    statements: ($) =>
      prec.right(
        seq($.statement, repeat(seq($.seps, $.statement)), optional($.seps)),
      ),

    // Either statements (with optional seps around) OR at least one sep by itself
    block: ($) =>
      choice(seq(repeat($.sep_unit), $.statements, repeat($.sep_unit)), $.seps),

    // Statements are expressions (assignment is part of expression parsing)
    statement: ($) => choice($.magic_command, $.expression),

    // expressions
    // ===========
    // Expressions: assignment or pipe
    expression: ($) => choice($.assignment, $.pipe_expr),

    // Assignment as right-associative operator; binds looser than pipe
    assignment: ($) =>
      prec.right(
        1,
        seq(field("left", $.pipe_expr), ":", field("right", $.expression)),
      ),

    // Pipe
    // ====
    // Left-associative pipe where RHS is a postfix and LHS is a comma expr
    pipe_expr: ($) => prec.left(seq($.comma_expr, repeat(seq("|", $.postfix)))),

    // Comma
    // =====
    comma_expr: ($) =>
      prec.left(seq($.comparison, repeat(seq(",", $.comparison)))),

    // Precedence
    // ==========
    comparison: ($) =>
      prec.left(
        PREC.COMP,
        seq(
          $.additive,
          repeat(seq(choice("=", "~", "<", "<=", ">", ">="), $.additive)),
        ),
      ),

    additive: ($) =>
      prec.left(
        PREC.ADD,
        seq($.multiplicative, repeat(seq(choice("+", "-"), $.multiplicative))),
      ),

    multiplicative: ($) =>
      prec.left(
        PREC.MULT,
        seq($.unary, repeat(seq(choice("*", "/", "/.", "%", "%."), $.unary))),
      ),

    // Unary ::= { '-' | '#' } Power (-2^2 => -(2^2))
    unary: ($) =>
      choice(
        prec(PREC.UNARY, seq(repeat1(choice("-", "#")), $.power)),
        $.power,
      ),

    // Power ::= Postfix '^' Power | Postfix
    power: ($) =>
      choice(prec.right(PREC.POWER, seq($.postfix, "^", $.power)), $.postfix),

    // Postfix
    // =======
    // Postfix using left recursion but prioritize base-case primary
    postfix: ($) =>
      choice(
        field("primary", $.primary),
        prec.left(PREC.POSTFIX, seq($.postfix, $.suffix)),
      ),

    // Suffixes: brackets or juxtaposition
    suffix: ($) => choice($.index_suffix, $.juxtaposition_arg),

    index_suffix: ($) =>
      prec(
        PREC.POSTFIX,
        seq(token.immediate("["), optional($.bracket_items), "]"),
      ),

    // BracketItems ::= Item ( ReqItemSep Item )* [ ReqItemSep ]
    bracket_items: ($) =>
      seq(
        $.item,
        repeat(seq($.req_item_sep, $.item)),
        optional($.req_item_sep),
      ),

    item: ($) => $.expression,

    // ReqItemSep ::= [ { Comment | Newline } ] ';' [ { Comment | Newline } ]
    // comments are extras; allow optional newlines around ';'
    req_item_sep: ($) =>
      seq(optional(repeat1($.newline)), ";", optional(repeat1($.newline))),

    // JuxtapositionArg ::= Unary but not starting with '-'
    nonminus_unary: ($) =>
      choice(
        prec(PREC.UNARY, seq(repeat1("#"), $.power)), // '#' prefixes allowed
        $.power, // or just a power
      ),
    juxtaposition_arg: ($) => prec(PREC.POSTFIX, $.nonminus_unary),

    // Primary forms
    // =============
    primary: ($) =>
      choice(
        $.literal,
        $.variable_ref,
        $.function_literal,
        $.paren_list_or_dict,
        $.conditional,
        $.conditional_dot,
        $.while_form,
        $.for_form,
        $.return_form,
        $.break_form,
        $.continue_form,
        $.assert_form,
        $.try_form,
      ),

    literal: ($) =>
      choice(
        $.integer,
        $.float,
        $.character,
        $.string,
        $.symbol_lit,
        $.true,
        $.false,
        $.inf,
        $.nan,
      ),

    // Builtin identifiers: special names treated distinctly for highlighting and semantics
    builtin: (_) =>
      choice(
        "abs",
        "alloc",
        "and",
        "arccos",
        "arccosh",
        "arcsinarcsinh",
        "arctan",
        "arctanh",
        "asciiplot",
        "atom?",
        "bandbin",
        "bnot",
        "bor",
        "bxor",
        "cat",
        "ceilchr",
        "cos",
        "cosh",
        "count",
        "decode",
        "depthdict?",
        "echo",
        "encode",
        "exec",
        "exp",
        "fclosefexists?",
        "flatten",
        "float?",
        "floor",
        "fmt",
        "freadfreadt",
        "freadtln",
        "fseek",
        "fsize",
        "ftell",
        "fwritefwritet",
        "hash",
        "hex",
        "idot",
        "input",
        "intint?",
        "intlist?",
        "iota",
        "keys",
        "list?",
        "lnlog",
        "m?",
        "mkdir",
        "neg",
        "not",
        "null?number?",
        "oct",
        "open",
        "or",
        "ord",
        "raiserand",
        "reshape",
        "reverse",
        "rg",
        "round",
        "sgnshape",
        "shl",
        "showt",
        "shr",
        "sin",
        "sinhsqrt",
        "str",
        "str?",
        "symbol",
        "tan",
        "tanhtype",
        "typev",
        "uniform?",
        "where",
        "xor",
      ),

    variable_ref: ($) => choice($.builtin, $.identifier),

    // FunctionLiteral ::= '{' [ParamList] Block '}' with empty-block allowed via optional(block)
    function_literal: ($) =>
      seq("{", optional($.param_list), optional($.block), "}"),

    param_list: ($) =>
      seq("[", optional(seq($.param, repeat(seq(";", $.param)))), "]"),

    param: ($) => $.identifier,

    // ParenListOrDict: () | DictBody | ListBody
    paren_list_or_dict: ($) =>
      seq(
        "(",
        optional(repeat1($.newline)),
        choice(")", $.dict_body, $.list_body),
      ),

    // ListBody ::= Expression ( ReqItemSep Expression )* [ ReqItemSep ] ')'
    list_body: ($) =>
      seq(
        $.expression,
        repeat(seq($.req_item_sep, $.expression)),
        optional($.req_item_sep),
        ")",
      ),

    // DictBody ::= Symbol ':' Expression ( ReqItemSep Symbol ':' Expression )* [ ReqItemSep ] ')'
    dict_body: ($) =>
      seq(
        $.symbol_lit,
        ":",
        $.expression,
        repeat(seq($.req_item_sep, $.symbol_lit, ":", $.expression)),
        optional($.req_item_sep),
        ")",
      ),

    // Control forms
    // =============
    conditional: ($) =>
      seq(
        "$",
        "[",
        field("cond", $.expression),
        $.control_sep,
        field("t_branch", $.branch),
        $.control_true_false_sep,
        field("f_branch", $.branch),
        "]",
      ),

    conditional_dot: ($) =>
      seq(
        choice("$.", seq("$", ".")),
        "[",
        field("cond", $.expression),
        $.control_sep,
        field("t_branch", $.branch),
        "]",
      ),

    while_form: ($) =>
      seq(
        "W",
        "[",
        field("cond", $.expression),
        $.control_sep,
        field("body", $.branch),
        "]",
      ),

    for_form: ($) =>
      seq(
        "N",
        "[",
        field("count", $.expression),
        $.control_sep,
        field("body", $.branch),
        "]",
      ),

    control_sep: ($) =>
      prec.left(
        choice(seq(";", optional(repeat1($.newline))), repeat1($.newline)),
      ),

    control_true_false_sep: ($) =>
      prec.left(
        choice(seq(";", optional(repeat1($.newline))), repeat1($.newline)),
      ),

    // Branch ::= [ { Comment | Newline } ] Expression { BranchInnerSep Expression }
    branch: ($) =>
      prec.left(
        seq(
          repeat($.newline),
          $.statement,
          repeat(seq($.branch_inner_sep, $.statement)),
        ),
      ),

    branch_inner_sep: ($) => choice($.newline, ";"),

    // Control flow primaries
    // ======================
    // Prefer '@r <expr>'; bare '@r' only when caller stops it
    return_form: ($) => choice(prec.right(1, seq("@r", $.expression)), "@r"),
    // Include an optional trailing newline variant so the literal '@b'/'@c'
    // appears in node-types as a terminal
    break_form: ($) => prec.left(choice(seq("@b", optional($.newline)), "@b")),
    continue_form: ($) =>
      prec.left(choice(seq("@c", optional($.newline)), "@c")),
    assert_form: ($) => seq("@a", $.expression),
    try_form: ($) => seq("@t", $.expression),

    // Tokens
    // ======
    // identifier: (_) => /[A-Za-z_][A-Za-z0-9_?]*/,
    identifier: ($) => /[\p{ID_Start}_][\p{ID_Continue}_?]*/u,

    integer: ($) => token(/[0-9]+/),
    float: ($) => token(/[0-9]+\.[0-9]+/),

    character: ($) => token(seq("'", /([^'\\]|\\.)/, "'")),
    string: ($) => token(seq('"', /([^"\\]|\\.)*/, '"')),

    // symbol_lit: (_) => token(seq("`", /[A-Za-z_][A-Za-z0-9_?]*/)),
    symbol_lit: ($) => token(seq("`", /[\p{ID_Start}_][\p{ID_Continue}_?]*/u)),

    true: ($) => "true",
    false: ($) => "false",
    inf: ($) => "inf",
    nan: ($) => "nan",

    comment: ($) => token(seq("//", /[^\n]*/)),

    newline: ($) => token(/\r?\n+/),

    shebang: ($) => token(seq("#!", /[^\n]*/)),
  },
});
