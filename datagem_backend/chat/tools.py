import subprocess
import json
import time
import os
# Note: pandas, matplotlib, seaborn, numpy are only used in subprocess execution, not imported here

#
# This file now just defines the *Python functions* themselves.
# The "blueprints" for the AI will be defined in agent.py
#

# Global dataset storage (per request)
_current_dataset = None

def set_dataset(dataset_data: list[dict] | None):
    """Set the current dataset for code execution."""
    global _current_dataset
    _current_dataset = dataset_data

def run_python_code(code: str, dataset_data: list[dict] | None = None) -> str:
    """
    Runs a given string of Python code in a secure, isolated process.
    This is the "fireproof box" (sandbox) for data analysis.
    The code MUST use `print()` to output any results.
    If dataset_data is provided, it will be available as a pandas DataFrame named 'df'.
    """
    
    try:
        # Prepare the full code with dataset if available
        full_code = ""
        
        # Add imports
        full_code += "import pandas as pd\n"
        full_code += "import matplotlib.pyplot as plt\n"
        full_code += "import seaborn as sns\n"
        full_code += "import numpy as np\n"
        full_code += "import io\n"
        full_code += "import base64\n"
        # Try to import sklearn, but don't fail if it's not available
        full_code += "try:\n"
        full_code += "    from sklearn import *\n"
        full_code += "    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV\n"
        full_code += "    from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge, Lasso\n"
        full_code += "    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor\n"
        full_code += "    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, mean_squared_error, r2_score, classification_report, confusion_matrix\n"
        full_code += "    from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder\n"
        full_code += "    import sklearn\n"
        full_code += "    sklearn_available = True\n"
        full_code += "except ImportError:\n"
        full_code += "    sklearn_available = False\n"
        full_code += "    print('Warning: sklearn is not installed. Install it with: pip install scikit-learn')\n\n"
        
        # Add dataset if provided
        if dataset_data:
            # Convert dataset to DataFrame JSON and load it
            df_json = json.dumps(dataset_data)
            full_code += f"# Load dataset\n"
            full_code += f"import json\n"
            full_code += f"dataset_json = {repr(df_json)}\n"
            full_code += f"df = pd.DataFrame(json.loads(dataset_json))\n"
            full_code += f"# Convert numeric columns to proper types\n"
            full_code += f"for col in df.columns:\n"
            full_code += f"    try:\n"
            full_code += f"        # Try to convert to numeric, coerce errors to NaN\n"
            full_code += f"        df[col] = pd.to_numeric(df[col], errors='coerce')\n"
            full_code += f"    except:\n"
            full_code += f"        pass  # Keep as string if conversion fails\n"
            full_code += f"print(f'Dataset loaded: {{df.shape[0]}} rows × {{df.shape[1]}} columns')\n"
            full_code += f"print(f'Columns: {{list(df.columns)}}')\n"
            full_code += f"numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()\n"
            full_code += f"print(f'Numeric columns: {{numeric_cols}}')\n\n"
        else:
            full_code += "# No dataset provided. Create sample data if needed.\n"
            full_code += "df = None\n\n"
        
        # Add user's code
        full_code += code
        
        # Run the code - try to use the Python from the virtual environment
        import sys
        python_executable = sys.executable  # Use the same Python that's running this script
        
        result = subprocess.run(
            [python_executable, '-c', full_code],
            capture_output=True,
            text=True,
            timeout=30,  # 30-second timeout to prevent hanging
            check=False,  # Don't raise on error, we'll handle it
            env={**os.environ, 'PYTHONUNBUFFERED': '1'}  # Ensure unbuffered output
        )
        
        # Combine stdout and stderr for better error visibility
        output = result.stdout
        stderr_output = result.stderr
        
        # Check return code first
        if result.returncode != 0:
            # If there's an error, format it nicely
            error_msg = f"Code execution failed (exit code {result.returncode}):\n"
            if output:
                error_msg += f"{output}\n"
            if stderr_output:
                # Filter out common numpy/matplotlib warnings that aren't critical
                if "DTypePromotionError" in stderr_output:
                    error_msg += f"\n--- Error ---\n"
                    error_msg += "Data type error: Some columns have mixed types. "
                    error_msg += "Please use only numeric columns for plotting, or convert columns to numeric first.\n"
                    error_msg += f"Full error: {stderr_output[:500]}"
                else:
                    error_msg += f"\n--- Errors/Warnings ---\n{stderr_output}"
            else:
                error_msg += "\n(No error details available)"
            return error_msg
        
        # If successful but has warnings in stderr, append them (filter out matplotlib warnings)
        if stderr_output and output:
            # Only show warnings if they're not just matplotlib/numpy warnings
            if not ("UserWarning" in stderr_output and "matplotlib" in stderr_output.lower()) and \
               not ("DTypePromotionError" in stderr_output or "numpy" in stderr_output.lower()):
                output += f"\n\n--- Warnings ---\n{stderr_output}"
        
        if not output or output.strip() == "":
            return "Code ran successfully with no output. (Did you forget to use `print()`?)"
        
        return output

    except subprocess.TimeoutExpired:
        return "Error: Code execution timed out after 30 seconds. The code may be taking too long or stuck in an infinite loop."
    except subprocess.CalledProcessError as e:
        # Return the standard error if the code crashes
        error_msg = e.stderr if e.stderr else str(e)
        return f"Error: {error_msg}"
    except Exception as e:
        return f"An unexpected error occurred: {str(e)}"

def google_search(query: str) -> str:
    """
    A placeholder function for Google Search.
    In a real app, this would use a Search API.
    """
    print(f"Tool: Pretending to search Google for: {query}")
    # We will simulate a result
    time.sleep(1) # Pretend it's working
    return f"Search results for '{query}': Found 3 articles about data analytics."
