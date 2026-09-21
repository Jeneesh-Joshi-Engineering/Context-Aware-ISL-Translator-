"""Evaluate a saved transit-hub classifier and write reproducible metrics."""
from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt

def main():
 p=argparse.ArgumentParser(); p.add_argument("--dataset-version",default="v1"); p.add_argument("--dataset-root",default=None); a=p.parse_args()
 root=Path(__file__).resolve().parents[1]; data=Path(a.dataset_root or root/"dataset"/"processed")/a.dataset_version; out=root/"saved_model"/a.dataset_version
 X,y=np.load(data/"X_test.npy"),np.load(data/"y_test.npy"); enc=json.loads((data/"label_encoder.json").read_text(encoding="utf-8")); labels=enc.get("classes") or list(enc)
 probs=tf.keras.models.load_model(out/"model.h5").predict(X,verbose=0); pred=probs.argmax(axis=1); report=classification_report(y,pred,target_names=labels,zero_division=0,output_dict=True)
 cm=confusion_matrix(y,pred,labels=range(len(labels))); fig,ax=plt.subplots(figsize=(8,6)); ax.imshow(cm,cmap="Blues"); ax.set_xticks(range(len(labels)),labels,rotation=45,ha="right"); ax.set_yticks(range(len(labels)),labels); [ax.text(j,i,str(v),ha="center",va="center") for i,row in enumerate(cm) for j,v in enumerate(row)]; fig.tight_layout(); fig.savefig(out/"confusion_matrix.png",dpi=150)
 fallback=float((probs.max(axis=1)<.6).mean()); lines=["# Evaluation Report","",f"- Test accuracy: {float((pred==y).mean()):.4f}",f"- Fallback-trigger rate (<60% confidence): {fallback:.2%}","","## Per-class metrics","","| Label | Precision | Recall | F1 |","|---|---:|---:|---:|"]
 lines += [f"| {x} | {report[x]['precision']:.4f} | {report[x]['recall']:.4f} | {report[x]['f1-score']:.4f} |" for x in labels]; (out/"evaluation_report.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
if __name__ == "__main__": main()
