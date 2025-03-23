# Lambda Layer Structure

The Lambda Layer must follow AWS's required structure:

```
lambda_layer/
└── python/           # Python packages must be in a "python" directory
    └── lib/
        └── python3.12/
            └── site-packages/
                └── [package files]
```

To properly package dependencies:

1. Create the proper directory structure:
   ```bash
   mkdir -p lambda_layer/python/lib/python3.12/site-packages
   ```

2. Install requirements into the site-packages directory:
   ```bash
   pip install -r requirements.txt -t lambda_layer/python/lib/python3.12/site-packages/
   ```