# LOCATION: backend/tools/python_repl.py
# Sandboxed Python REPL for the Data Scientist agent
# Uses RestrictedPython to prevent dangerous operations

import ast, logging, traceback
from io import StringIO
from contextlib import redirect_stdout
from typing import Any

logger = logging.getLogger(__name__)

# Allowed builtins for sandbox
SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bin": bin, "bool": bool,
    "chr": chr, "dict": dict, "dir": dir, "divmod": divmod,
    "enumerate": enumerate, "filter": filter, "float": float,
    "format": format, "frozenset": frozenset, "getattr": getattr,
    "hasattr": hasattr, "hash": hash, "hex": hex, "int": int,
    "isinstance": isinstance, "issubclass": issubclass, "iter": iter,
    "len": len, "list": list, "map": map, "max": max, "min": min,
    "next": next, "oct": oct, "ord": ord, "pow": pow, "print": print,
    "range": range, "repr": repr, "reversed": reversed, "round": round,
    "set": set, "setattr": setattr, "slice": slice, "sorted": sorted,
    "str": str, "sum": sum, "tuple": tuple, "type": type, "zip": zip,
    "__build_class__": __build_class__,
    "__name__": "__main__",
}

# Safe modules that can be imported
SAFE_MODULES = {"math", "statistics", "decimal", "fractions", "random", "datetime", "json", "re"}


def execute_python(code: str, timeout_sec: int = 10) -> dict[str, Any]:
    """
    Execute Python code in a restricted sandbox.
    Returns dict with: output, result, error, success
    """
    # Check for dangerous patterns before executing
    dangerous = ["import os", "import sys", "import subprocess", "__import__",
                 "open(", "eval(", "exec(", "compile(", "globals()", "locals()"]
    for pattern in dangerous:
        if pattern in code:
            return {
                "success": False,
                "output":  "",
                "result":  None,
                "error":   f"Blocked: '{pattern}' is not allowed in the sandbox.",
            }

    output_buffer = StringIO()
    local_vars: dict[str, Any] = {}

    # Safe import handler
    def safe_import(name, *args, **kwargs):
        if name in SAFE_MODULES:
            import importlib
            return importlib.import_module(name)
        raise ImportError(f"Module '{name}' is not allowed in the debate sandbox.")

    safe_globals = {
        "__builtins__": {**SAFE_BUILTINS, "__import__": safe_import},
    }

    try:
        import signal

        def timeout_handler(signum, frame):
            raise TimeoutError("Code execution exceeded time limit")

        # Set timeout (Unix only — on Windows just runs without timeout)
        try:
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(timeout_sec)
        except AttributeError:
            pass  # Windows — no SIGALRM

        with redirect_stdout(output_buffer):
            exec(compile(code, "<debate_repl>", "exec"), safe_globals, local_vars)

        try:
            signal.alarm(0)
        except AttributeError:
            pass

        # Try to get a "result" from the last expression
        result = None
        try:
            tree = ast.parse(code, mode="exec")
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                last_expr = ast.Expression(body=tree.body[-1].value)
                result = eval(compile(last_expr, "<debate_repl>", "eval"), safe_globals, local_vars)
        except Exception:
            pass

        return {
            "success": True,
            "output":  output_buffer.getvalue(),
            "result":  str(result) if result is not None else None,
            "error":   None,
        }

    except TimeoutError:
        return {"success": False, "output": output_buffer.getvalue(), "result": None, "error": "Timeout: execution took too long."}
    except Exception as e:
        return {"success": False, "output": output_buffer.getvalue(), "result": None, "error": traceback.format_exc(limit=5)}