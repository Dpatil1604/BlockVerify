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
        bool isValid;
        bool exists;
    }

    mapping(string => Certificate) private certificates;

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

    event CertificateRevoked(
        string certificateId
    );

    // Only the authorized institution wallet can issue/update/revoke
    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only authorized institution can perform this action"
        );
        _;
    }

    // The wallet deploying the contract becomes the authorized institution
    constructor() {
        owner = msg.sender;
    }

    // Issue a new certificate
    function issueCertificate(
        string memory _certificateId,
        string memory _studentName,
        string memory _course
    ) public onlyOwner {

        require(
            !certificates[_certificateId].exists,
            "Certificate already exists"
        );

        certificates[_certificateId] = Certificate({
            certificateId: _certificateId,
            studentName: _studentName,
            course: _course,
            issuer: msg.sender,
            issueDate: block.timestamp,
            isValid: true,
            exists: true
        });

        emit CertificateIssued(
            _certificateId,
            _studentName,
            _course,
            msg.sender,
            block.timestamp
        );
    }

    // Verify certificate
    function verifyCertificate(
        string memory _certificateId
    )
        public
        view
        returns (
            string memory certificateId,
            string memory studentName,
            string memory course,
            address issuer,
            uint256 issueDate,
            bool isValid
        )
    {
        require(
            certificates[_certificateId].exists,
            "Certificate not found"
        );

        Certificate memory cert = certificates[_certificateId];

        return (
            cert.certificateId,
            cert.studentName,
            cert.course,
            cert.issuer,
            cert.issueDate,
            cert.isValid
        );
    }

    // Update certificate details
    function updateCertificate(
        string memory _certificateId,
        string memory _studentName,
        string memory _course
    ) public onlyOwner {

        require(
            certificates[_certificateId].exists,
            "Certificate not found"
        );

        require(
            certificates[_certificateId].isValid,
            "Cannot update revoked certificate"
        );

        certificates[_certificateId].studentName = _studentName;
        certificates[_certificateId].course = _course;

        emit CertificateUpdated(
            _certificateId,
            _studentName,
            _course
        );
    }

    // Revoke certificate
    function revokeCertificate(
        string memory _certificateId
    ) public onlyOwner {

        require(
            certificates[_certificateId].exists,
            "Certificate not found"
        );

        certificates[_certificateId].isValid = false;

        emit CertificateRevoked(_certificateId);
    }
}