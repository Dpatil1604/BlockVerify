
const contractAddress = "0xc2dB01E2d3B5dA71C13459290Fc2d713CBEd82E5";
const contractABI = [
    "function owner() view returns (address)",
    "function issueCertificate(string,string,string)",
    "function verifyCertificate(string) view returns (string,string,string,address,uint256,bool)",
    "function updateCertificate(string,string,string)",
    "function revokeCertificate(string)",
    "function getCertificate(string) view returns (string,string,string,address,uint256,uint256,bool,bool)",
    "function certificateExists(string) view returns (bool)",
    "function getCertificateStatus(string) view returns (bool)",
    "function getCertificateIssuer(string) view returns (address)",
    "function getCertificateIssueDate(string) view returns (uint256)",
    "function getTotalCertificates() view returns (uint256)",
    "function getCertificatesByIssuer(address) view returns (string[])",
    "function getCertificateCountByStatus() view returns (uint256,uint256)",
    "function setCertificateExpiry(string,uint256)",
    "function isCertificateExpired(string) view returns (bool)",
    "function totalCertificates() view returns (uint256)",
    "function validCertificates() view returns (uint256)",
    "function revokedCertificates() view returns (uint256)",
    "event CertificateIssued(string indexed certificateId,string studentName,string course,address issuer,uint256 issueDate)",
    "event CertificateUpdated(string indexed certificateId,string studentName,string course)",
    "event CertificateRevoked(string indexed certificateId)",
    "event CertificateExpirySet(string indexed certificateId,uint256 expiryDate)"
];

let provider;
let signer;
let contract;
let connectedAccount;
let issuerCertificates = [];

function getErrorMessage(error) {
    if (!error) return "";
    if (error.reason) return error.reason;
    if (error.shortMessage) return error.shortMessage;
    if (error.info?.error?.message) return error.info.error.message;
    if (error.message) return error.message;
    return "";
}

function getReadContract() {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    const readProvider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(contractAddress, contractABI, readProvider);
}

async function checkAdminWallet() {
    try {
        if (!contract || !connectedAccount) return false;
        const ownerAddress = await contract.owner();
        return connectedAccount.toLowerCase() === ownerAddress.toLowerCase();
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function getCertificate(certificateId) {
    try {
        const readContract = getReadContract();
        if (!(await readContract.certificateExists(certificateId))) return null;
        return await readContract.getCertificate(certificateId);
    } catch (error) {
        console.error("Get certificate error:", error);
        return null;
    }
}

function updateWalletButtons(isConnected, isAdmin = false) {
    const connectButton = document.getElementById("connectWalletBtn");
    const disconnectButton = document.getElementById("disconnectWalletBtn");

    if (connectButton) {
        connectButton.innerText = isConnected
            ? (isAdmin ? "Institution Wallet Connected" : "Wallet Connected")
            : "Connect Institution Wallet";
    }

    if (disconnectButton) {
        disconnectButton.style.display = isConnected ? "block" : "none";
    }
}

async function connectWallet() {
    if (!window.ethereum) {
        alert("MetaMask is not installed.\n\nPlease install MetaMask to use the institution portal.");
        return;
    }

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        connectedAccount = await signer.getAddress();
        contract = new ethers.Contract(contractAddress, contractABI, signer);

        const ownerAddress = await contract.owner();
        const isAdmin = connectedAccount.toLowerCase() === ownerAddress.toLowerCase();

        updateWalletButtons(true, isAdmin);

        if (!isAdmin) {
            alert("Wallet connected, but this is not the authorized institution wallet.\n\nOnly the owner can perform administrative operations.");
            return;
        }

        alert("Institution wallet connected successfully!\n\n" + connectedAccount);
        await getCertificatesByIssuer();
    } catch (error) {
        console.error("Wallet connection error:", error);
        if (getErrorMessage(error).toLowerCase().includes("user rejected")) {
            alert("Wallet connection was rejected.");
        } else {
            alert("Failed to connect wallet.\n\nPlease make sure MetaMask is connected to your Ganache network.");
        }
        resetWalletConnection();
    }
}

function resetWalletConnection() {
    provider = null;
    signer = null;
    contract = null;
    connectedAccount = null;
    issuerCertificates = [];
    updateWalletButtons(false);
    clearIssuerDashboard();
}

function disconnectWallet() {
    resetWalletConnection();
    alert("Wallet disconnected from the BlockVerify portal.\n\nTo reconnect, click Connect Institution Wallet.");
}

function clearIssuerDashboard() {
    const ids = ["issuerTotal", "issuerValid", "issuerRevoked", "issuerExpired"];
    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = "0";
    });

    const resultBox = document.getElementById("issuerResult");
    const detailsBox = document.getElementById("issuerDetails");

    if (resultBox) {
        resultBox.innerHTML = "<p>Connect the institution wallet and click Refresh to load certificates.</p>";
    }
    if (detailsBox) detailsBox.innerHTML = "";
}

async function verifyCertificate() {
    const input = document.getElementById("certificateId");
    const resultBox = document.getElementById("result");
    const certificateId = input ? input.value.trim() : "";

    if (!certificateId) {
        alert("Please enter a Certificate ID.");
        return;
    }

    try {
        const readContract = getReadContract();

        if (!(await readContract.certificateExists(certificateId))) {
            if (resultBox) {
                resultBox.innerHTML = `
                    <div class="not-found">
                        <h3>Certificate Not Found</h3>
                        <p>No certificate exists with this Certificate ID.</p>
                    </div>`;
            }
            return;
        }

        const certificate = await readContract.getCertificate(certificateId);
        const expired = await readContract.isCertificateExpired(certificateId);

        const status = expired ? "EXPIRED" : certificate[6] ? "VALID" : "REVOKED";
        const statusClass = status === "VALID"
            ? "status-valid"
            : status === "EXPIRED"
                ? "status-expired"
                : "status-revoked";

        const issueDateText = Number(certificate[4]) === 0
            ? "Not available"
            : new Date(Number(certificate[4]) * 1000).toLocaleString();

        const expiryDateText = Number(certificate[5]) === 0
            ? "No expiry date"
            : new Date(Number(certificate[5]) * 1000).toLocaleString();

        if (resultBox) {
            resultBox.innerHTML = `
                <div class="result-card">
                    <h3>${status === "VALID" ? "Certificate Valid" : "Certificate " + status}</h3>
                    <p><strong>Certificate ID:</strong> ${escapeHtml(certificate[0])}</p>
                    <p><strong>Student Name:</strong> ${escapeHtml(certificate[1])}</p>
                    <p><strong>Course:</strong> ${escapeHtml(certificate[2])}</p>
                    <p><strong>Issuer:</strong> ${escapeHtml(certificate[3])}</p>
                    <p><strong>Issue Date:</strong> ${escapeHtml(issueDateText)}</p>
                    <p><strong>Expiry Date:</strong> ${escapeHtml(expiryDateText)}</p>
                    <p><strong>Status:</strong> <span class="${statusClass}">${status}</span></p>
                </div>`;
        }
    } catch (error) {
        console.error("Verification error:", error);
        if (resultBox) {
            resultBox.innerHTML = `
                <div class="not-found">
                    <h3>Verification Failed</h3>
                    <p>Unable to verify the certificate. Check MetaMask and the Ganache network.</p>
                </div>`;
        }
    }
}

async function issueCertificate() {
    if (!contract) {
        alert("Please connect the institution wallet first.");
        return;
    }

    if (!(await checkAdminWallet())) {
        alert("Unauthorized wallet. Only the institution wallet can issue certificates.");
        return;
    }

    const certificateId = document.getElementById("issueCertificateId").value.trim();
    const studentName = document.getElementById("studentName").value.trim();
    const course = document.getElementById("course").value.trim();

    if (!certificateId || !studentName || !course) {
        alert("Please fill in Certificate ID, Student Name and Course / Degree.");
        return;
    }

    try {
        if (await contract.certificateExists(certificateId)) {
            alert("Certificate already exists. Please use a different Certificate ID.");
            return;
        }

        const transaction = await contract.issueCertificate(certificateId, studentName, course);
        alert("Transaction submitted. Please confirm it in MetaMask.");
        await transaction.wait();

        alert("Certificate issued successfully!");
        document.getElementById("issueCertificateId").value = "";
        document.getElementById("studentName").value = "";
        document.getElementById("course").value = "";
        await getCertificatesByIssuer();
    } catch (error) {
        console.error("Issue certificate error:", error);
        const message = getErrorMessage(error).toLowerCase();

        if (message.includes("user rejected")) {
            alert("Transaction cancelled by the user.");
        } else if (message.includes("already exists")) {
            alert("Certificate already exists. Please use a different ID.");
        } else {
            alert("Failed to issue certificate.\n\n" + getErrorMessage(error));
        }
    }
}

async function updateCertificate() {
    if (!contract) {
        alert("Please connect the institution wallet first.");
        return;
    }

    if (!(await checkAdminWallet())) {
        alert("Unauthorized wallet. Only the institution wallet can update certificates.");
        return;
    }

    const certificateId = document.getElementById("updateCertificateId").value.trim();
    const studentName = document.getElementById("updateStudentName").value.trim();
    const course = document.getElementById("updateCourse").value.trim();

    if (!certificateId || !studentName || !course) {
        alert("Please fill in Certificate ID, Student Name and Course / Degree.");
        return;
    }

    const certificate = await getCertificate(certificateId);

    if (!certificate) {
        alert("Certificate not found. You can only update an issued certificate.");
        return;
    }

    if (!certificate[6]) {
        alert("This certificate is revoked or expired and cannot be updated.");
        return;
    }

    try {
        const transaction = await contract.updateCertificate(certificateId, studentName, course);
        alert("Update transaction submitted. Please confirm it in MetaMask.");
        await transaction.wait();

        alert("Certificate updated successfully!");
        document.getElementById("updateCertificateId").value = "";
        document.getElementById("updateStudentName").value = "";
        document.getElementById("updateCourse").value = "";
        await getCertificatesByIssuer();
    } catch (error) {
        console.error("Update certificate error:", error);
        alert("Failed to update certificate.\n\n" + getErrorMessage(error));
    }
}

async function revokeCertificate() {
    if (!contract) {
        alert("Please connect the institution wallet first.");
        return;
    }

    if (!(await checkAdminWallet())) {
        alert("Unauthorized wallet. Only the institution wallet can revoke certificates.");
        return;
    }

    const certificateId = document.getElementById("revokeCertificateId").value.trim();

    if (!certificateId) {
        alert("Please enter a Certificate ID.");
        return;
    }

    const certificate = await getCertificate(certificateId);

    if (!certificate) {
        alert("Certificate not found.");
        return;
    }

    if (!certificate[6]) {
        alert("This certificate is already revoked or expired.");
        return;
    }

    try {
        const transaction = await contract.revokeCertificate(certificateId);
        alert("Revoke transaction submitted. Please confirm it in MetaMask.");
        await transaction.wait();

        alert("Certificate revoked successfully!");
        document.getElementById("revokeCertificateId").value = "";
        await getCertificatesByIssuer();
    } catch (error) {
        console.error("Revoke certificate error:", error);
        alert("Failed to revoke certificate.\n\n" + getErrorMessage(error));
    }
}

// Set or update certificate expiry using the date input
async function setCertificateExpiry() {
    if (!contract) {
        alert("Please connect the institution wallet first.");
        return;
    }

    if (!(await checkAdminWallet())) {
        alert("Unauthorized wallet. Only the institution wallet can set expiry.");
        return;
    }

    const idInput = document.getElementById("expiryCertificateId");
    const dateInput = document.getElementById("certificateExpiryDate");
    const certificateId = idInput ? idInput.value.trim() : "";
    const dateValue = dateInput ? dateInput.value : "";

    if (!certificateId) {
        alert("Please enter a Certificate ID.");
        return;
    }

    if (!dateValue) {
        alert("Please select an expiry date. The date form requires a date.");
        return;
    }

    const selectedDate = new Date(dateValue + "T23:59:59");
    const timestamp = Math.floor(selectedDate.getTime() / 1000);

    if (!Number.isSafeInteger(timestamp) || timestamp <= Math.floor(Date.now() / 1000)) {
        alert("Please select a future expiry date.");
        return;
    }

    try {
        if (!(await contract.certificateExists(certificateId))) {
            alert("Certificate not found.");
            return;
        }

        const transaction = await contract.setCertificateExpiry(certificateId, timestamp);
        alert("Expiry update submitted. Confirm the transaction in MetaMask.");
        await transaction.wait();

        alert("Certificate expiry updated successfully!");
        idInput.value = "";
        dateInput.value = "";
        await getCertificatesByIssuer();
    } catch (error) {
        console.error("Set expiry error:", error);
        alert("Failed to set certificate expiry.\n\n" + getErrorMessage(error));
    }
}

// Display total number of certificates
async function getTotalCertificates() {
    const resultBox = document.getElementById("statisticsResult");

    try {
        const readContract = getReadContract();
        const total = await readContract.getTotalCertificates();

        if (resultBox) {
            resultBox.innerHTML = `
                <div class="result-card">
                    <h3>Certificate Statistics</h3>
                    <p><strong>Total Certificates Issued:</strong> ${escapeHtml(total.toString())}</p>
                </div>`;
        }
    } catch (error) {
        console.error("Total certificate error:", error);
        if (resultBox) {
            resultBox.innerHTML = `<div class="not-found">Unable to load total certificates. Check MetaMask and Ganache.</div>`;
        }
    }
}

// Display valid and revoked counters
async function getCertificateCountByStatus() {
    const resultBox = document.getElementById("statisticsResult");

    try {
        const readContract = getReadContract();
        const counts = await readContract.getCertificateCountByStatus();

        if (resultBox) {
            resultBox.innerHTML = `
                <div class="result-card">
                    <h3>Certificate Counts</h3>
                    <p><strong>Valid Count:</strong> ${escapeHtml(counts[0].toString())}</p>
                    <p><strong>Revoked Count:</strong> ${escapeHtml(counts[1].toString())}</p>
                    <p><small>Note: Expired certificates may still be included in the stored valid count until revoked.</small></p>
                </div>`;
        }
    } catch (error) {
        console.error("Certificate count error:", error);
        if (resultBox) {
            resultBox.innerHTML = `<div class="not-found">Unable to load certificate counts.</div>`;
        }
    }
}

// Load certificates issued by the connected institution wallet
async function getCertificatesByIssuer() {
    const resultBox = document.getElementById("issuerResult");

    if (!contract || !connectedAccount) {
        if (resultBox) {
            resultBox.innerHTML = "<p>Connect the institution wallet and click Refresh to load certificates.</p>";
        }
        return;
    }

    if (!(await checkAdminWallet())) {
        if (resultBox) {
            resultBox.innerHTML = `<div class="not-found">Only the authorized institution wallet can view this dashboard.</div>`;
        }
        return;
    }

    if (resultBox) resultBox.innerHTML = "<p>Loading issued certificates...</p>";

    try {
        const readContract = getReadContract();
        const certificateIds = await readContract.getCertificatesByIssuer(connectedAccount);

        issuerCertificates = await Promise.all(
            certificateIds.map(async id => {
                const certificate = await readContract.getCertificate(id);
                const expired = await readContract.isCertificateExpired(id);
                const status = expired ? "EXPIRED" : certificate[6] ? "VALID" : "REVOKED";

                return {
                    id: certificate[0],
                    studentName: certificate[1],
                    course: certificate[2],
                    issuer: certificate[3],
                    issueDate: Number(certificate[4]),
                    expiryDate: Number(certificate[5]),
                    status
                };
            })
        );

        updateIssuerSummary();
        filterIssuerCertificates();
    } catch (error) {
        console.error("Issuer certificates error:", error);
        if (resultBox) {
            resultBox.innerHTML = `
                <div class="not-found">
                    <h3>Unable to Load Certificates</h3>
                    <p>Check MetaMask, the Ganache network and your institution wallet.</p>
                </div>`;
        }
    }
}

// Update dashboard summary cards
function updateIssuerSummary() {
    const total = issuerCertificates.length;
    const valid = issuerCertificates.filter(c => c.status === "VALID").length;
    const revoked = issuerCertificates.filter(c => c.status === "REVOKED").length;
    const expired = issuerCertificates.filter(c => c.status === "EXPIRED").length;

    const values = {
        issuerTotal: total,
        issuerValid: valid,
        issuerRevoked: revoked,
        issuerExpired: expired
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// Search and filter issuer certificates
function filterIssuerCertificates() {
    const searchInput = document.getElementById("issuerSearch");
    const statusFilter = document.getElementById("issuerStatusFilter");
    const resultBox = document.getElementById("issuerResult");

    if (!resultBox) return;

    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selectedStatus = statusFilter ? statusFilter.value : "ALL";

    const filteredCertificates = issuerCertificates.filter(certificate => {
        const matchesSearch =
            certificate.id.toLowerCase().includes(searchText) ||
            certificate.studentName.toLowerCase().includes(searchText) ||
            certificate.course.toLowerCase().includes(searchText);

        const matchesStatus =
            selectedStatus === "ALL" || certificate.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    if (issuerCertificates.length === 0) {
        resultBox.innerHTML = `
            <div class="not-found">
                <h3>No Issued Certificates</h3>
                <p>No certificates are associated with the connected institution wallet.</p>
            </div>`;
        return;
    }

    if (filteredCertificates.length === 0) {
        resultBox.innerHTML = `
            <div class="not-found">
                <h3>No Matching Certificates</h3>
                <p>Try a different search term or status filter.</p>
            </div>`;
        return;
    }

    const rows = filteredCertificates.map(certificate => {
        const statusClass = certificate.status === "VALID"
            ? "status-valid"
            : certificate.status === "EXPIRED"
                ? "status-expired"
                : "status-revoked";

        const encodedId = encodeURIComponent(certificate.id);

        return `
            <tr>
                <td>${escapeHtml(certificate.id)}</td>
                <td>${escapeHtml(certificate.studentName)}</td>
                <td>${escapeHtml(certificate.course)}</td>
                <td><span class="${statusClass}">${certificate.status}</span></td>
                <td>
                    <button class="primary-btn issuer-view-btn" type="button"
                        onclick="showIssuerCertificateDetails(decodeURIComponent('${encodedId}'))">
                        View Details
                    </button>
                </td>
            </tr>`;
    }).join("");

    resultBox.innerHTML = `
        <div class="issuer-table-container">
            <table class="issuer-table">
                <thead>
                    <tr>
                        <th>Certificate ID</th>
                        <th>Student Name</th>
                        <th>Course / Degree</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="issuer-table-count">
                Showing ${filteredCertificates.length} of ${issuerCertificates.length} certificates
            </p>
        </div>`;
}

// Display selected certificate details
function showIssuerCertificateDetails(certificateId) {
    const detailsBox = document.getElementById("issuerDetails");
    if (!detailsBox) return;

    const certificate = issuerCertificates.find(c => c.id === certificateId);

    if (!certificate) {
        detailsBox.innerHTML = `
            <div class="not-found">
                <p>Certificate details not found. Refresh the dashboard and try again.</p>
            </div>`;
        return;
    }

    const issueDateText = certificate.issueDate === 0
        ? "Not available"
        : new Date(certificate.issueDate * 1000).toLocaleString();

    const expiryDateText = certificate.expiryDate === 0
        ? "No expiry date"
        : new Date(certificate.expiryDate * 1000).toLocaleString();

    const statusClass = certificate.status === "VALID"
        ? "status-valid"
        : certificate.status === "EXPIRED"
            ? "status-expired"
            : "status-revoked";

    detailsBox.innerHTML = `
        <div class="result-card issuer-details-card">
            <h3>Certificate Details</h3>
            <p><strong>Certificate ID:</strong> ${escapeHtml(certificate.id)}</p>
            <p><strong>Student Name:</strong> ${escapeHtml(certificate.studentName)}</p>
            <p><strong>Course / Degree:</strong> ${escapeHtml(certificate.course)}</p>
            <p><strong>Issuer Wallet:</strong> ${escapeHtml(certificate.issuer)}</p>
            <p><strong>Issue Date:</strong> ${escapeHtml(issueDateText)}</p>
            <p><strong>Expiry Date:</strong> ${escapeHtml(expiryDateText)}</p>
            <p><strong>Status:</strong> <span class="${statusClass}">${certificate.status}</span></p>
            <button class="danger-btn issuer-close-btn" type="button"
                onclick="document.getElementById('issuerDetails').innerHTML = ''">
                Close Details
            </button>
        </div>`;

    detailsBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Additional contract read helpers
async function getCertificateStatus(certificateId) {
    const readContract = getReadContract();
    return await readContract.getCertificateStatus(certificateId);
}

async function getCertificateIssuer(certificateId) {
    const readContract = getReadContract();
    return await readContract.getCertificateIssuer(certificateId);
}

async function getCertificateIssueDate(certificateId) {
    const readContract = getReadContract();
    return await readContract.getCertificateIssueDate(certificateId);
}

async function isCertificateExpired(certificateId) {
    const readContract = getReadContract();
    return await readContract.isCertificateExpired(certificateId);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function scrollToVerification() {
    const section = document.getElementById("verification");
    if (section) section.scrollIntoView({ behavior: "smooth" });
}

// Reset app connection when the MetaMask account or network changes
if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => {
        resetWalletConnection();
    });

    window.ethereum.on("chainChanged", () => {
        resetWalletConnection();
    });
}