import urllib.request
import zipfile
import io
import json
import csv
import os

def download_and_process():
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00320/student.zip"
    print(f"Downloading dataset from {url}...")
    
    # Download the ZIP file
    try:
        response = urllib.request.urlopen(url)
        zip_data = response.read()
        print("Download complete. Unzipping...")
    except Exception as e:
        print(f"Error downloading: {e}")
        return

    # Extract student-mat.csv
    with zipfile.ZipFile(io.BytesIO(zip_data)) as z:
        # List files inside zip
        files = z.namelist()
        print("Files in zip:", files)
        
        if "student-mat.csv" in files:
            z.extract("student-mat.csv", ".")
            print("Extracted student-mat.csv")
        else:
            print("student-mat.csv not found in the zip!")
            return

    # Read and parse CSV
    students = []
    print("Parsing student-mat.csv...")
    with open("student-mat.csv", mode="r", encoding="utf-8") as f:
        # The file uses semicolon delimiter
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            # Convert numeric columns
            processed_row = {}
            for key, val in row.items():
                try:
                    # Try to convert numeric fields
                    processed_row[key] = int(val)
                except ValueError:
                    try:
                        processed_row[key] = float(val)
                    except ValueError:
                        # Keep as string
                        processed_row[key] = val
            students.append(processed_row)

    print(f"Loaded {len(students)} student records.")

    # Save as JSON for easy consumption in React
    os.makedirs("src/data", exist_ok=True)
    with open("src/data/students.json", "w", encoding="utf-8") as f:
        json.dump(students, f, indent=2)
    print("Saved src/data/students.json")

    # Run a simple linear regression in Python to find reference coefficients
    # G3 = b0 + b1*G1 + b2*G2
    import math
    
    # Let's extract G1, G2, G3
    n = len(students)
    sum_g1 = sum(s['G1'] for s in students)
    sum_g2 = sum(s['G2'] for s in students)
    sum_g3 = sum(s['G3'] for s in students)
    
    sum_g1_sq = sum(s['G1']**2 for s in students)
    sum_g2_sq = sum(s['G2']**2 for s in students)
    sum_g1_g2 = sum(s['G1']*s['G2'] for s in students)
    
    sum_g1_g3 = sum(s['G1']*s['G3'] for s in students)
    sum_g2_g3 = sum(s['G2']*s['G3'] for s in students)
    
    A = [
        [n, sum_g1, sum_g2],
        [sum_g1, sum_g1_sq, sum_g1_g2],
        [sum_g2, sum_g1_g2, sum_g2_sq]
    ]
    B = [sum_g3, sum_g1_g3, sum_g2_g3]
    
    def determinant_3x3(m):
        return (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
                m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
                m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
    
    det_A = determinant_3x3(A)
    if det_A == 0:
        print("Determinant is zero, cannot solve OLS.")
        return
        
    A0 = [
        [B[0], sum_g1, sum_g2],
        [B[1], sum_g1_sq, sum_g1_g2],
        [B[2], sum_g1_g2, sum_g2_sq]
    ]
    A1 = [
        [n, B[0], sum_g2],
        [sum_g1, B[1], sum_g1_g2],
        [sum_g2, B[2], sum_g2_sq]
    ]
    A2 = [
        [n, sum_g1, B[0]],
        [sum_g1, sum_g1_sq, B[1]],
        [sum_g2, sum_g1_g2, B[2]]
    ]
    
    beta_0 = determinant_3x3(A0) / det_A
    beta_1 = determinant_3x3(A1) / det_A
    beta_2 = determinant_3x3(A2) / det_A
    
    print(f"OLS Equation: G3 = {beta_0:.4f} + {beta_1:.4f} * G1 + {beta_2:.4f} * G2")
    
    y_mean = sum_g3 / n
    ss_tot = sum((s['G3'] - y_mean)**2 for s in students)
    ss_res = 0
    predictions = []
    
    for s in students:
        pred = beta_0 + beta_1 * s['G1'] + beta_2 * s['G2']
        pred_clamped = max(0, min(20, pred))
        predictions.append(pred_clamped)
        ss_res += (s['G3'] - pred_clamped)**2
        
    mse = ss_res / n
    rmse = math.sqrt(mse)
    r2 = 1 - (ss_res / ss_tot)
    
    print(f"Model Performance:")
    print(f"  MSE: {mse:.4f}")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  R^2: {r2:.4f}")
    
    model_metadata = {
        "model_type": "Multiple Linear Regression",
        "equation": f"G3 = {beta_0:.4f} + {beta_1:.4f} * G1 + {beta_2:.4f} * G2",
        "coefficients": {
            "intercept": beta_0,
            "G1": beta_1,
            "G2": beta_2
        },
        "metrics": {
            "mse": mse,
            "rmse": rmse,
            "r2": r2,
            "n_samples": n
        }
    }
    
    with open("src/data/model_meta.json", "w", encoding="utf-8") as f:
        json.dump(model_metadata, f, indent=2)
    print("Saved src/data/model_meta.json")

if __name__ == "__main__":
    download_and_process()
