#!/bin/bash

# Initialize an empty string to keep track of failed contracts
failed_contracts=""

# Create or empty the log file
log_file="myth-analysis.log"
echo "" > "$log_file"

# File to store the counter and list of successful contracts
counter_file="myth_temp_counter.txt"
success_file="myth_temp_success.txt"
echo "0" > "$counter_file"  # Initialize counter
> "$success_file"  # Initialize success_file

version=$(myth version)
echo ""
echo -e "\e[34m[Security Analysis]\e[0m $version"
echo "[Security Analysis] $version" >> "$log_file"

detectors=$(myth list-detectors)
echo -e "\e[34m[Detectors]\e[0m"
echo -e "$detectors"
echo "[Detectors]" >> "$log_file"
echo "$detectors" >> "$log_file"

# Find all .sol files in contracts/ directory and its subdirectories
find contracts/ -name "*.sol" | while read -r sol_file; do
  # Extract the contract name from the file path
  contract_name=$(basename "$sol_file")

  # Skip contracts that start with 'I' or include 'interface'
  if [[ $contract_name == I* || $contract_name == *interface* ]]; then
    continue
  fi

  echo -e "\e[33m[Analyzing]\e[0m $sol_file"
  echo "[Analyzing] $sol_file" >> "$log_file"

  # Run myth analyze and capture the output
  output=$(myth analyze "$sol_file" --solc-json solc.json --execution-timeout 20 2>&1)

  # Append the output to the log file with 'Output:' prefix
  echo "Output: $output" >> "$log_file"

  # Increment the counter
  counter=$(<"$counter_file")
  ((counter++))
  echo "$counter" > "$counter_file"

  # Check if the output contains the success message
  if [[ $output == *"The analysis was completed successfully. No issues were detected."* ]]; then
    echo -e "\e[32m[Success]\e[0m analyzing $sol_file"
    echo "[Success] analyzing $sol_file" >> "$log_file"
    echo "$sol_file" >> "$success_file"
  else
    echo -e "\e[31m[Failed]\e[0m to analyze $sol_file"
    echo "[Failed] to analyze $sol_file" >> "$log_file"
  fi
done

# Retrieve the counter and list of successful contracts
counter=$(<"$counter_file")
successful_contracts=$(<"$success_file")

# Clean up the temp files
rm "$counter_file" "$success_file"

# Print and log the list of failed contracts, if any
if [ ! -z "$failed_contracts" ]; then
  echo -e "\e[31mThe following contracts failed analysis:\e[0m"
  echo "The following contracts failed analysis:" >> "$log_file"
  echo -e "$failed_contracts" | tee -a "$log_file"
else
  echo -e "\e[32mAll $counter contracts analyzed successfully.\e[0m"
  echo "All $counter contracts analyzed successfully." >> "$log_file"
fi

# Output the list of all tested contracts
echo -e "\e[34mTested $counter contracts:\e[0m"
echo "Tested $counter contracts:" >> "$log_file"
echo "$successful_contracts"
echo "$successful_contracts" >> "$log_file"
