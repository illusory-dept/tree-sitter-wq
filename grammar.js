// grammar.js

const PREC = {
  POSTFIX: 9,
  POWER: 8,
  UNARY: 7,
  MULT: 6,
  COMP: 5,
  ADD: 4,
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
    // Allow an arbitrary interleave of statements and separators
    source_file: ($) => repeat(choice($.statement, $.sep_unit)),

    // separators
    // ==========
    // atomic separator unit: either ';' or one+ newlines
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

    // either statements (with optional seps around) OR at least one sep by itself
    block: ($) =>
      choice(seq(repeat($.sep_unit), $.statements, repeat($.sep_unit)), $.seps),

    // Statements are expressions (assignment is part of expression parsing)
    statement: ($) => $.expression,

    // expressions
    // ===========

    // Expressions: assignment or plain comma expression
    expression: ($) => choice($.assignment, $.comma_expr),

    // Assignment as right-associative operator without LHS restriction
    assignment: ($) =>
      prec.right(
        1,
        seq(field("left", $.comma_expr), ":", field("right", $.expression)),
      ),

    // comma
    // =====

    comma_expr: ($) =>
      // Additive { ',' Additive }
      prec.left(seq($.additive, repeat(seq(",", $.additive)))),

    // precedence
    // ==========

    additive: ($) =>
      prec.left(
        PREC.ADD,
        seq($.comparison, repeat(seq(choice("+", "-"), $.comparison))),
      ),

    comparison: ($) =>
      prec.left(
        PREC.COMP,
        seq(
          $.multiplicative,
          repeat(
            seq(choice("=", "!=", "<", "<=", ">", ">="), $.multiplicative),
          ),
        ),
      ),

    multiplicative: ($) =>
      prec.left(
        PREC.MULT,
        seq($.unary, repeat(seq(choice("*", "/", "/.", "%", "%."), $.unary))),
      ),

    // Power ::= Postfix '^' Power | Postfix
    power: ($) =>
      choice(prec.right(PREC.POWER, seq($.postfix, "^", $.power)), $.postfix),

    // Unary ::= { '-' | '#' } Power (-2^2 => -(2^2))
    unary: ($) =>
      choice(
        prec(PREC.UNARY, seq(repeat1(choice("-", "#")), $.power)),
        $.power,
      ),

    // postfix
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

    // primary forms
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

    variable_ref: ($) => $.identifier,

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

    // control forms
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

    // control-flow primaries
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

    // tokens
    // ======

    identifier: ($) => /[A-Za-z_][A-Za-z0-9_?]*/,

    integer: ($) => token(/[0-9]+/),
    float: ($) => token(/[0-9]+\.[0-9]+/),

    character: ($) => token(seq("'", /([^'\\]|\\.)/, "'")),
    string: ($) => token(seq('"', /([^"\\]|\\.)*/, '"')),

    symbol_lit: ($) => token(seq("`", /[A-Za-z_][A-Za-z0-9_?]*/)),

    true: ($) => "true",
    false: ($) => "false",
    inf: ($) => choice("Inf", "inf"),
    nan: ($) => choice("NaN", "nan"),

    comment: ($) => token(seq("//", /[^\n]*/)),

    newline: ($) => token(/\r?\n+/),
  },
});
