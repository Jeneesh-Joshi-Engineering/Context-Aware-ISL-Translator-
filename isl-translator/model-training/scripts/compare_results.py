"""Compare evaluation reports for two recorded vocabulary versions."""
from __future__ import annotations
import argparse,re
from pathlib import Path
def metrics(path):
 t=path.read_text(encoding="utf-8"); return re.findall(r"(?:Test accuracy|Fallback-trigger rate \(<60% confidence\)): ([0-9.]+%?)",t)
def main():
 p=argparse.ArgumentParser();p.add_argument("before");p.add_argument("after");a=p.parse_args();root=Path(__file__).resolve().parents[1]/"saved_model"; b,aft=root/a.before/"evaluation_report.md",root/a.after/"evaluation_report.md"; (root/"comparison_report.md").write_text(f"# Vocabulary Comparison\n\n| KPI | {a.before} | {a.after} |\n|---|---:|---:|\n| Overall accuracy | {metrics(b)[0]} | {metrics(aft)[0]} |\n| Fallback-trigger rate | {metrics(b)[1]} | {metrics(aft)[1]} |\n\nPer-class F1 remains in each version's evaluation report.\n",encoding="utf-8")
if __name__ == "__main__":main()
