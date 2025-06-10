import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./CustomView.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { Modal, Button } from "react-bootstrap";
import * as XLSX from "xlsx";

const Answer = ({ qn }) => {
    const [file, setFile] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [sqlQuery, setSqlQuery] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [queryErrors, setQueryErrors] = useState([]);
    const [resultErrors, setResultErrors] = useState([]);

    // Expected answer format for validation
    const expectedAnswer = {
        query: "SELECT StockItem.[$Name], StockItem.[$Parent] AS [StockItem_$Parent], StockGroup.[$Parent] AS [StockGroup_$Parent] FROM StockItem LEFT JOIN StockGroup ON StockItem.[$Parent] = StockGroup.[$Name];",
        expectedResults: {
            columns: ["$Name", "StockItem_$Parent", "StockGroup_$Parent"],
            rowCount: 4,
            requiredValues: {
                "$Name": ["122", "Accent Exe Vin:284287", "Accent GLE Executive E3 Engn.G4EBAM268599", "Accent GLE EXE Vin:298416"],
                "StockItem_$Parent": ["Primary", "Vehicle", "Vehicle", "Primary"],
                "StockGroup_$Parent": ["Primary", "Primary", "Primary", "Primary"]
            }
        }
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (droppedFile.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                setErrorMessage("Please upload a valid .xlsx file.");
                return;
            }
            setFile(droppedFile);
        }
    };

    const handleFileUpload = (e) => {
        const uploadedFile = e.target.files[0];
        setErrorMessage("");
        setResultErrors([]);
        if (uploadedFile) {
            if (uploadedFile.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                setErrorMessage("Please upload a valid .xlsx file.");
                return;
            }
            setFile(uploadedFile);
        }
    };    const validateQuery = (query) => {
        const errors = [];
        const lowercaseQuery = query.toLowerCase();
          if (!lowercaseQuery.includes("select")) errors.push("Query must include SELECT");
        if (!lowercaseQuery.includes("from stockitem")) errors.push("Query must include FROM");
        if (!lowercaseQuery.includes("left join stockgroup")) errors.push("Query must include LEFT JOIN");
        if (!lowercaseQuery.includes("stockitem.[$parent] = stockgroup.[$name]")) {
            errors.push("Incorrect or missing join condition");
        }
        
        // Check for required fields and aliases
        const requiredElements = [
            {field: "stockitem.[$name]", message: "Missing [$Name] field"},
            {field: "stockitem.[$parent]", message: "Missing [$Parent] field"},
            {field: "stockgroup.[$parent]", message: "Missing StockGroup.[$Parent] field"},
            {field: "as [stockitem_$parent]", message: "Missing [StockItem_$Parent] alias"},
            {field: "as [stockgroup_$parent]", message: "Missing [StockGroup_$Parent] alias"}
        ];
        
        requiredElements.forEach(element => {
            if (!lowercaseQuery.includes(element.field.toLowerCase())) {
                errors.push(element.message);
            }
        });

        return errors;
    };

    const validateExcelResult = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);                    const errors = [];
                    const columns = Object.keys(jsonData[0] || {});

                    // Perform all validations independently
                      // 1. Check columns
                    const missingColumns = [];
                    expectedAnswer.expectedResults.columns.forEach(col => {
                        if (!columns.includes(col)) {
                            missingColumns.push(col);
                        }
                    });
                      if (missingColumns.length > 0) {
                        errors.push("The result file is missing some required columns");
                    }

                    // 2. Check row count (perform even if columns are missing)
                    if (jsonData.length !== expectedAnswer.expectedResults.rowCount) {
                        errors.push(`Incorrect number of rows`);
                    }                    // 3. Check required values for columns that exist
                    Object.entries(expectedAnswer.expectedResults.requiredValues).forEach(([column, values]) => {
                        if (columns.includes(column) && values.length > 0) {
                            const resultValues = jsonData.map(row => row[column]?.toString());
                            const missingValues = values.filter(value => !resultValues.includes(value));
                            if (missingValues.length > 0) {
                                errors.push(`Missing or incorrect values in column ${column}`);
                            }
                        }
                    });

                    resolve(errors);
                } catch (err) {
                    reject(["Failed to process the Excel file"]);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };    const handleValidateButton = async () => {
        setErrorMessage("");
        setQueryErrors([]);
        setResultErrors([]);

        let hasErrors = false;

        if (!sqlQuery.trim()) {
            setQueryErrors(["Please enter a query"]);
            hasErrors = true;
        }
        
        if (!file) {
            setResultErrors(["Please upload a result file"]);
            hasErrors = true;
        }

        if (hasErrors) {
            return;
        }

        // Validate SQL Query
        const queryValidationErrors = validateQuery(sqlQuery);
        setQueryErrors(queryValidationErrors);

        // Validate Excel Results
        try {
            const resultValidationErrors = await validateExcelResult(file);
            setResultErrors(resultValidationErrors);

            if (queryValidationErrors.length === 0 && resultValidationErrors.length === 0) {
                setShowModal(true);
            } else {
                setErrorMessage("Please correct the errors below");
            }
        } catch (err) {
            setResultErrors(err);
            setErrorMessage("Error validating results");
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFile(null);
        setSqlQuery("");
        setErrorMessage("");
        setQueryErrors([]);
        setResultErrors([]);
    };

    return (
        <div>
            <div className="container answer-block">
                {/* SQL Query Input */}
                <div className="row mb-4">
                    <div className="col-12">
                        <label className="form-label qn-label">Write your MS Access SQL Query:</label>
                        <textarea
                            className="form-control query-input"
                            rows="4"
                            value={sqlQuery}
                            onChange={(e) => setSqlQuery(e.target.value)}
                            placeholder="SELECT StockItem.[$Name], StockItem.[$Parent] AS [StockItem_$Parent]..."                            style={{
                                fontFamily: "Consolas, monospace",
                                backgroundColor: (queryErrors.length > 0 || (!sqlQuery.trim() && errorMessage)) ? '#FCE8F1' : 'white'
                            }}
                        />
                        {queryErrors.length > 0 && (
                            <div className="query-errors mt-2">
                                {queryErrors.map((error, index) => (
                                    <div key={index} className="error-message">
                                        <i className="bi bi-exclamation-circle"></i> {error}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Existing File Upload Section */}
                <div className="upload-area text-center">                    <div
                        className="drag-drop-area rounded text-center p-4 pb-5 pt-4"
                        onDrop={handleFileDrop}
                        onDragOver={(e) => e.preventDefault()}
                        style={{ backgroundColor: resultErrors.length > 0 ? '#FCE8F1' : (file ? '#F4FCF6' : 'white') }}
                    >
                        <div className="upload-icon mb-1">
                            <i className={`bi bi-cloud-arrow-up-fill text-4xl ${file ? 'text-success' : 'text-primary'}`}></i>
                        </div>

                        {/* Uploaded File Name */}
                        {file && (
                            <div>
                                <div className="replace-file" onClick={() => document.getElementById('file-upload').click()}>Replace file</div>
                                <div className="file-name" style={{ display: "flex", alignItems: "center", borderBottom: file ? "6px solid green" : "none" }}>
                                <i className="bi bi-file-earmark" style={{ padding: "5px", "paddingRight": "10px" }}></i>
                                <div style={{ textAlign: "left", marginLeft: "10px" }}>
                                    <span>{file.name}</span> <br />
                                    <span style={{ color: "grey", fontWeight: "lighter" }}>{(file.size / 1024).toFixed(2)} KB</span>
                                </div>
                            </div>
                            </div>
                        )}

                        <input
                            type="file"
                            id="file-upload"
                            onChange={handleFileUpload}
                            hidden
                        />
                        <div>
                            <p className="mb-1" style={{ fontSize: "19px" }}>
                                Drag your excel file or{" "}
                                <label htmlFor="file-upload" className="text-primary cursor-pointer underline" style={{ fontWeight: "bolder" }}>
                                    browse
                                </label>
                            </p>
                            <div className="text-muted">Supported file: .xls, .xlsx</div>
                        </div>
                    </div>
                </div>

                {resultErrors.length > 0 && (
                    <div className="result-errors mt-3">
                        {resultErrors.map((error, index) => (
                            <div key={index} className="error-message">
                                <i className="bi bi-exclamation-circle"></i> {error}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Section with Validate Button */}
            <div className="bottom-section" style={{ backgroundColor: errorMessage ? '#FCE8F1' : '#fff' }}>
                <div className="errors-found">
                    {errorMessage && (
                        <div>
                            <img src={require('./error.png')} alt="Warning" style={{ width: "30px", marginRight: "13px" }} />
                            <span>Errors found!</span>
                        </div>
                    )}
                </div>
                <div className="col text-right">
                    <button
                        className="validate-btn"
                        onClick={handleValidateButton}
                    >
                        {errorMessage ? "Retry" : "Validate"}
                    </button>
                </div>
            </div>

            {/* Success Modal */}
            <Modal show={showModal} onHide={handleCloseModal} centered>
                <Modal.Body style={{ background: "linear-gradient(to bottom, #e0f7fa 0%, #fff 100%)" }}>
                    <div className="text-center" style={{ margin: "20px 20px", fontSize: "21px" }}>
                        <img src={require('./degree.png')} alt="Success" style={{ width: "250px", marginBottom: "20px" }} />
                        <p style={{ fontWeight: "bold", fontSize: "30px" }}>Congratulations!</p>
                        <p>You have completed the task successfully.</p>
                        <Button className="done-btn mt-3 mb-3" onClick={handleCloseModal}>
                            Done
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default Answer;
