
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertificateVerification {
    address public owner;

    struct Certificate {
        string certificateId;
        string studentName;
        string course;
        address issuer;
        uint256 issueDate;
        uint256 expiryDate;
        bool isValid;
        bool exists;
    }

    mapping(string => Certificate) private certificates;
    mapping(address => string[]) private certificatesByIssuer;

    uint256 public totalCertificates;
    uint256 public validCertificates;
    uint256 public revokedCertificates;

    event CertificateIssued(
        string certificateId,
        string studentName,
        string course,
        address issuer,
        uint256 issueDate
    );
    event CertificateUpdated(
        string certificateId,
        string studentName,
        string course
    );
    event CertificateRevoked(string certificateId);
    event CertificateExpirySet(string certificateId, uint256 expiryDate);

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only authorized institution can perform this action"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // 1. Issue a new certificate
    function issueCertificate(
        string memory _certificateId,
        string memory _studentName,
        string memory _course
    ) public onlyOwner {
        require(bytes(_certificateId).length > 0, "Certificate ID required");
        require(bytes(_studentName).length > 0, "Student name required");
        require(bytes(_course).length > 0, "Course required");
        require(!certificates[_certificateId].exists, "Certificate already exists");

        certificates[_certificateId] = Certificate({
            certificateId: _certificateId,
            studentName: _studentName,
            course: _course,
            issuer: msg.sender,
            issueDate: block.timestamp,
            expiryDate: 0,
            isValid: true,
            exists: true
        });

        certificatesByIssuer[msg.sender].push(_certificateId);
        totalCertificates++;
        validCertificates++;

        emit CertificateIssued(
            _certificateId,
            _studentName,
            _course,
            msg.sender,
            block.timestamp
        );
    }

    // 2. Verify certificate details and validity
    function verifyCertificate(
        string memory _certificateId
    ) public view returns (
        string memory certificateId,
        string memory studentName,
        string memory course,
        address issuer,
        uint256 issueDate,
        bool isValid
    ) {
        require(certificates[_certificateId].exists, "Certificate not found");

        Certificate memory cert = certificates[_certificateId];
        bool valid = cert.isValid &&
            (cert.expiryDate == 0 || block.timestamp <= cert.expiryDate);

        return (
            cert.certificateId,
            cert.studentName,
            cert.course,
            cert.issuer,
            cert.issueDate,
            valid
        );
    }

    // 3. Update certificate details
    function updateCertificate(
        string memory _certificateId,
        string memory _studentName,
        string memory _course
    ) public onlyOwner {
        require(certificates[_certificateId].exists, "Certificate not found");
        require(certificates[_certificateId].isValid, "Certificate revoked");
        require(
            certificates[_certificateId].expiryDate == 0 ||
            block.timestamp <= certificates[_certificateId].expiryDate,
            "Certificate expired"
        );
        require(bytes(_studentName).length > 0, "Student name required");
        require(bytes(_course).length > 0, "Course required");

        certificates[_certificateId].studentName = _studentName;
        certificates[_certificateId].course = _course;

        emit CertificateUpdated(_certificateId, _studentName, _course);
    }

    // 4. Revoke a certificate
    function revokeCertificate(
        string memory _certificateId
    ) public onlyOwner {
        require(certificates[_certificateId].exists, "Certificate not found");
        require(certificates[_certificateId].isValid, "Certificate already revoked");

        certificates[_certificateId].isValid = false;
        validCertificates--;
        revokedCertificates++;

        emit CertificateRevoked(_certificateId);
    }

    // 5. Get complete certificate record
    function getCertificate(
        string memory _certificateId
    ) public view returns (
        string memory certificateId,
        string memory studentName,
        string memory course,
        address issuer,
        uint256 issueDate,
        uint256 expiryDate,
        bool isValid,
        bool exists
    ) {
        Certificate memory cert = certificates[_certificateId];

        bool valid = cert.isValid &&
            (cert.expiryDate == 0 || block.timestamp <= cert.expiryDate);

        return (
            cert.certificateId,
            cert.studentName,
            cert.course,
            cert.issuer,
            cert.issueDate,
            cert.expiryDate,
            valid,
            cert.exists
        );
    }

    // 6. Check whether certificate exists
    function certificateExists(
        string memory _certificateId
    ) public view returns (bool) {
        return certificates[_certificateId].exists;
    }

    // 7. Get certificate status
    function getCertificateStatus(
        string memory _certificateId
    ) public view returns (bool) {
        require(certificates[_certificateId].exists, "Certificate not found");

        Certificate memory cert = certificates[_certificateId];
        return cert.isValid &&
            (cert.expiryDate == 0 || block.timestamp <= cert.expiryDate);
    }

    // 8. Get certificate issuer
    function getCertificateIssuer(
        string memory _certificateId
    ) public view returns (address) {
        require(certificates[_certificateId].exists, "Certificate not found");
        return certificates[_certificateId].issuer;
    }

    // 9. Get certificate issue date
    function getCertificateIssueDate(
        string memory _certificateId
    ) public view returns (uint256) {
        require(certificates[_certificateId].exists, "Certificate not found");
        return certificates[_certificateId].issueDate;
    }

    // 10. Get total number of certificates
    function getTotalCertificates() public view returns (uint256) {
        return totalCertificates;
    }

    // 11. Get certificate IDs issued by a wallet
    function getCertificatesByIssuer(
        address _issuer
    ) public view returns (string[] memory) {
        return certificatesByIssuer[_issuer];
    }

    // 12. Get valid and revoked certificate counts
    function getCertificateCountByStatus()
        public
        view
        returns (uint256 validCount, uint256 revokedCount)
    {
        return (validCertificates, revokedCertificates);
    }

    // 13. Set or update certificate expiry date
    // Use 0 for no expiry; otherwise provide a future Unix timestamp.
    function setCertificateExpiry(
        string memory _certificateId,
        uint256 _expiryDate
    ) public onlyOwner {
        require(certificates[_certificateId].exists, "Certificate not found");
        require(certificates[_certificateId].isValid, "Certificate revoked");
        require(
            _expiryDate == 0 || _expiryDate > block.timestamp,
            "Expiry must be in the future"
        );

        certificates[_certificateId].expiryDate = _expiryDate;
        emit CertificateExpirySet(_certificateId, _expiryDate);
    }

    // 14. Check whether certificate has expired
    function isCertificateExpired(
        string memory _certificateId
    ) public view returns (bool) {
        require(certificates[_certificateId].exists, "Certificate not found");

        uint256 expiry = certificates[_certificateId].expiryDate;
        return expiry != 0 && block.timestamp > expiry;
    }
}