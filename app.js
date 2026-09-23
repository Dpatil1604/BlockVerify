const contractAddress="0x480Aef68CE01EC69c638310b6D7563Fe5D3513Cd";

const contractABI=[
    "function owner() view returns (address)",
    "function issueCertificate(string,string,string)",
    "function verifyCertificate(string) view returns (string,string,string,address,uint256,bool)",
    "function updateCertificate(string,string,string)",
    "function revokeCertificate(string)"
];

let provider;
let signer;
let contract;
let connectedAccount;

function getErrorMessage(error){
    if(!error)return "";
    if(error.reason)return error.reason;
    if(error.shortMessage)return error.shortMessage;
    if(error.message)return error.message;
    if(error.info&&error.info.error&&error.info.error.message){
        return error.info.error.message;
    }
    return "";
}

async function checkAdminWallet(){
    try{
        const ownerAddress=await contract.owner();
        return connectedAccount.toLowerCase()===ownerAddress.toLowerCase();
    }catch(error){
        console.error(error);
        return false;
    }
}

async function getCertificate(certificateId){
    try{
        const readProvider=new ethers.BrowserProvider(window.ethereum);
        const readContract=new ethers.Contract(
            contractAddress,
            contractABI,
            readProvider
        );
        return await readContract.verifyCertificate(certificateId);
    }catch(error){
        return null;
    }
}

async function connectWallet(){
    if(!window.ethereum){
        alert("MetaMask is not installed.\n\nPlease install MetaMask to use the institution portal.");
        return;
    }

    try{
        provider=new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts",[]);
        signer=await provider.getSigner();
        connectedAccount=await signer.getAddress();

        contract=new ethers.Contract(
            contractAddress,
            contractABI,
            signer
        );

        const ownerAddress=await contract.owner();
        const connectButton=document.getElementById("connectWalletBtn");

        if(connectButton){
            if(connectedAccount.toLowerCase()===ownerAddress.toLowerCase()){
                connectButton.innerText="Institution Wallet Connected";
            }else{
                connectButton.innerText="Wallet Connected";
            }
        }

        if(connectedAccount.toLowerCase()!==ownerAddress.toLowerCase()){
            alert(
                "Wallet connected, but this is not the authorized institution wallet.\n\n"+
                "Issue, Update and Revoke operations are restricted."
            );
            return;
        }

        alert("Institution wallet connected successfully!\n\n"+connectedAccount);

    }catch(error){
        console.error("Wallet connection error:",error);
        const message=getErrorMessage(error);

        if(message.toLowerCase().includes("user rejected")){
            alert("Wallet connection was rejected.");
        }else{
            alert(
                "Failed to connect wallet.\n\n"+
                "Please make sure MetaMask is connected to your Ganache network."
            );
        }
    }
}

async function verifyCertificate(){
    const certificateId=document.getElementById("certificateId").value.trim();

    if(certificateId===""){
        alert("Please enter a Certificate ID.");
        return;
    }

    try{
        const readProvider=new ethers.BrowserProvider(window.ethereum);
        const readContract=new ethers.Contract(
            contractAddress,
            contractABI,
            readProvider
        );

        const result=await readContract.verifyCertificate(certificateId);
        const studentName=result[1];
        const course=result[2];
        const issuer=result[3];
        const issueDate=result[4];
        const isValid=result[5];

        const date=new Date(Number(issueDate)*1000);
        const resultBox=document.getElementById("result");

        if(resultBox){
            resultBox.innerHTML=`
                <h3>${isValid?"Certificate Valid":"Certificate Revoked"}</h3>
                <p><strong>Certificate ID:</strong>${result[0]}</p>
                <p><strong>Student Name:</strong>${studentName}</p>
                <p><strong>Course:</strong>${course}</p>
                <p><strong>Issuer:</strong>${issuer}</p>
                <p><strong>Issue Date:</strong>${date.toLocaleString()}</p>
                <p><strong>Status:</strong>${isValid?"VALID":"REVOKED"}</p>
            `;
        }

    }catch(error){
        console.error("Verification error:",error);

        const resultBox=document.getElementById("result");

        if(resultBox){
            resultBox.innerHTML=`
                <h3>Certificate Not Found</h3>
                <p>No certificate exists with this Certificate ID.</p>
            `;
        }
    }
}

async function issueCertificate(){
    if(!contract){
        alert("Please connect the institution wallet first.");
        return;
    }

    const isAdmin=await checkAdminWallet();

    if(!isAdmin){
        alert(
            "Unauthorized wallet.\n\n"+
            "Only the authorized institution wallet can issue certificates."
        );
        return;
    }

    const certificateId=document.getElementById("issueCertificateId").value.trim();
    const studentName=document.getElementById("studentName").value.trim();
    const course=document.getElementById("course").value.trim();

    if(certificateId===""){
        alert("Please enter a Certificate ID.");
        return;
    }

    if(studentName===""){
        alert("Please enter the Student Name.");
        return;
    }

    if(course===""){
        alert("Please enter the Course / Degree.");
        return;
    }

    const existingCertificate=await getCertificate(certificateId);

    if(existingCertificate){
        alert(
            "Certificate already exists.\n\n"+
            "Please use a different Certificate ID."
        );
        return;
    }

    try{
        const transaction=await contract.issueCertificate(
            certificateId,
            studentName,
            course
        );

        alert(
            "Transaction submitted.\n\n"+
            "Please confirm it in MetaMask."
        );

        await transaction.wait();

        alert("Certificate issued successfully!");

        document.getElementById("issueCertificateId").value="";
        document.getElementById("studentName").value="";
        document.getElementById("course").value="";

    }catch(error){
        console.error("Issue certificate error:",error);
        const message=getErrorMessage(error);

        if(message.toLowerCase().includes("user rejected")){
            alert("Transaction cancelled by the user.");
        }else if(message.includes("Certificate already exists")){
            alert(
                "Certificate already exists.\n\n"+
                "Please use a different Certificate ID."
            );
        }else if(message.includes("Only authorized institution")){
            alert(
                "Unauthorized wallet.\n\n"+
                "Only the authorized institution wallet can issue certificates."
            );
        }else{
            alert(
                "Failed to issue certificate.\n\n"+
                "Please check MetaMask and the Ganache network."
            );
        }
    }
}

async function updateCertificate(){
    if(!contract){
        alert("Please connect the institution wallet first.");
        return;
    }

    const isAdmin=await checkAdminWallet();

    if(!isAdmin){
        alert(
            "Unauthorized wallet.\n\n"+
            "Only the authorized institution wallet can update certificates."
        );
        return;
    }

    const certificateId=document.getElementById("updateCertificateId").value.trim();
    const studentName=document.getElementById("updateStudentName").value.trim();
    const course=document.getElementById("updateCourse").value.trim();

    if(certificateId===""){
        alert("Please enter a Certificate ID.");
        return;
    }

    if(studentName===""){
        alert("Please enter the new Student Name.");
        return;
    }

    if(course===""){
        alert("Please enter the new Course / Degree.");
        return;
    }

    const certificate=await getCertificate(certificateId);

    if(!certificate){
        alert(
            "Certificate not found.\n\n"+
            "You can only update a certificate that has already been issued."
        );
        return;
    }

    const isValid=certificate[5];

    if(!isValid){
        alert(
            "This certificate has already been revoked.\n\n"+
            "A revoked certificate cannot be updated."
        );
        return;
    }

    try{
        const transaction=await contract.updateCertificate(
            certificateId,
            studentName,
            course
        );

        alert(
            "Update transaction submitted.\n\n"+
            "Please confirm it in MetaMask."
        );

        await transaction.wait();

        alert("Certificate updated successfully!");

        document.getElementById("updateCertificateId").value="";
        document.getElementById("updateStudentName").value="";
        document.getElementById("updateCourse").value="";

    }catch(error){
        console.error("Update certificate error:",error);
        const message=getErrorMessage(error);

        if(message.toLowerCase().includes("user rejected")){
            alert("Transaction cancelled by the user.");
        }else if(message.includes("Certificate not found")){
            alert("Certificate not found.");
        }else if(message.includes("Cannot update revoked certificate")){
            alert(
                "This certificate has already been revoked and cannot be updated."
            );
        }else if(message.includes("Only authorized institution")){
            alert(
                "Unauthorized wallet.\n\n"+
                "Only the authorized institution wallet can update certificates."
            );
        }else{
            alert(
                "Failed to update certificate.\n\n"+
                "Please check MetaMask and the Ganache network."
            );
        }
    }
}

async function revokeCertificate(){
    if(!contract){
        alert("Please connect the institution wallet first.");
        return;
    }

    const isAdmin=await checkAdminWallet();

    if(!isAdmin){
        alert(
            "Unauthorized wallet.\n\n"+
            "Only the authorized institution wallet can revoke certificates."
        );
        return;
    }

    const certificateId=document.getElementById("revokeCertificateId").value.trim();

    if(certificateId===""){
        alert("Please enter a Certificate ID.");
        return;
    }

    const certificate=await getCertificate(certificateId);

    if(!certificate){
        alert(
            "Certificate not found.\n\n"+
            "There is no certificate with this ID."
        );
        return;
    }

    const isValid=certificate[5];

    if(!isValid){
        alert("This certificate is already revoked.");
        return;
    }

    try{
        const transaction=await contract.revokeCertificate(certificateId);

        alert(
            "Revoke transaction submitted.\n\n"+
            "Please confirm it in MetaMask."
        );

        await transaction.wait();

        alert("Certificate revoked successfully!");

        document.getElementById("revokeCertificateId").value="";

    }catch(error){
        console.error("Revoke certificate error:",error);
        const message=getErrorMessage(error);

        if(message.toLowerCase().includes("user rejected")){
            alert("Transaction cancelled by the user.");
        }else if(message.includes("Certificate not found")){
            alert("Certificate not found.");
        }else if(message.includes("Only authorized institution")){
            alert(
                "Unauthorized wallet.\n\n"+
                "Only the authorized institution wallet can revoke certificates."
            );
        }else{
            alert(
                "Failed to revoke certificate.\n\n"+
                "Please check MetaMask and the Ganache network."
            );
        }
    }
}

function scrollToVerification(){
    const section=document.getElementById("verification");

    if(section){
        section.scrollIntoView({
            behavior:"smooth"
        });
    }
}