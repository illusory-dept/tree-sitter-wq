package tree_sitter_wq_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_wq "github.com/illusory-dept/wq-tree-sitter/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_wq.Language())
	if language == nil {
		t.Errorf("Error loading wq grammar")
	}
}
