;; comments
(comment) @comment

;; literals
(integer)   @number
(float)     @number
(string)    @string
(character) @character
(symbol_lit) @constant.builtin
(true)  @constant.builtin
(false) @constant.builtin
(inf)   @constant.builtin
(nan)   @constant.builtin

;; identifiers
(variable_ref (identifier) @variable)
(identifier) @variable

;; keywords & control forms
((conditional "$"  @keyword))
((conditional_dot "$." @keyword))
((while_form "W" @keyword))
((for_form   "N" @keyword))

(return_form   "@r"  @keyword.return)
(break_form    "@b"   @keyword)
(continue_form "@c" @keyword)
(assert_form   "@a"  @keyword)
(try_form      "@t"     @keyword)

;; operators & punctuation
["+" "-" "*" "/" "/." "%" "%." "^"
 "=" "~" "<" "<=" ">" ">="] @operator

[":" "," ";"] @punctuation.delimiter
["(" ")" "[" "]" "{" "}"] @punctuation.bracket

;; Name binding when assigning a function literal: foo: { ... }
;; Capture the identifier anywhere within the left subtree when RHS has a function literal.
((assignment
   left: (_ (variable_ref (identifier) @function))) @assign
  (#has-descendant? @assign function_literal))

;; Fallback: highlight function literals themselves (body blocks)
(function_literal) @function

;; Function-like calls via juxtaposition: match one suffix level
((postfix
   (postfix
     primary: (primary (variable_ref (identifier) @function.call)))
   (suffix (juxtaposition_arg) @argument)))
