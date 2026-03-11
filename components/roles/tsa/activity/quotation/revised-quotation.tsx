"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, } from "@/components/ui/dropdown-menu";
import { AlertCircleIcon, PenIcon, MoreVertical, Calendar, Clock, Phone, PhilippinePeso, ChevronLeft, ChevronRight, Loader2, SearchX } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";

import { TaskListDialog } from "../tasklist/dialog/filter";
import TaskListEditDialog from "./dialog/edit";
import { AccountsActiveDeleteDialog } from "../planner/dialog/delete";

interface SupervisorDetails {
    firstname: string;
    lastname: string;
    email: string;
    profilePicture: string;
    signatureImage: string;
    contact: string;
}

interface Completed {
    id: number;
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_client: string;
    project_name?: string;
    product_category?: string;
    project_type?: string;
    source?: string;
    type_activity?: string;
    quotation_number?: string;
    quotation_amount?: number;
    ticket_reference_number?: string;
    remarks?: string;
    status?: string;
    start_date: string;
    end_date: string;
    date_created: string;
    date_updated?: string;
    account_reference_number?: string;
    quotation_type: string;
    company_name: string;
    contact_number: string;
    email_address: string;
    address: string;
    contact_person: string;
    tsm_approved_status: string;
    vat_type: string;
    delivery_fee: string;

    // Signatories
    agent_signature: string;
    agent_contact_number: string;
    agent_email_address: string;
    tsm_signature: string;
    tsm_contact_number: string;
    tsm_email_address: string;
    manager_signature: string;
    manager_contact_number: string;
    manager_email_address: string;

    tsm_approval_date: string;
    manager_approval_date: string;
    tsm_remarks: string;
    manager_remarks: string;
}

interface CompletedProps {
    referenceid: string;
    target_quota?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    contact?: string;
    tsmname?: string;
    managername?: string;
    dateCreatedFilterRange: any;
    setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
}

export const RevisedQuotation: React.FC<CompletedProps> = ({
    referenceid,
    target_quota,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    managername,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
}) => {
    const [activities, setActivities] = useState<Completed[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterTypeActivity, setFilterTypeActivity] = useState<string>("all");

    const [editItem, setEditItem] = useState<Completed | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [removeRemarks, setRemoveRemarks] = useState("");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [tsmDetails, setTsmDetails] = useState<SupervisorDetails | null>(null);
    const [managerDetails, setManagerDetails] = useState<SupervisorDetails | null>(null);

    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            return;
        }

        setLoading(true);
        setError(null);

        const from = dateCreatedFilterRange?.from
            ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
            : null;
        const to = dateCreatedFilterRange?.to
            ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
            : null;

        const url = new URL("/api/activity/tsa/quotation/fetch", window.location.origin);
        url.searchParams.append("referenceid", referenceid);
        if (from && to) {
            url.searchParams.append("from", from);
            url.searchParams.append("to", to);
        }

        fetch(url.toString())
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => setActivities(data.activities || []))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [referenceid, dateCreatedFilterRange]);

    useEffect(() => {
        if (!referenceid) return;
        fetchActivities();

        const channel = supabase
            .channel(`history-${referenceid}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
                () => { fetchActivities(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [referenceid, fetchActivities]);

    useEffect(() => {
        if (!referenceid) return;
        const fetchHierarchy = async () => {
            try {
                const response = await fetch(`/api/user?id=${encodeURIComponent(referenceid)}`);
                if (!response.ok) throw new Error("Failed to fetch hierarchy details");
                const data = await response.json();
                setTsmDetails(data.tsmDetails ?? null);
                setManagerDetails(data.managerDetails ?? null);
            } catch (error) { console.error("Hierarchy fetch error:", error); }
        };
        fetchHierarchy();
    }, [referenceid]);

    const sortedActivities = useMemo(() => {
        return [...activities].sort(
            (a, b) => new Date(b.date_updated ?? b.date_created).getTime() - new Date(a.date_updated ?? a.date_created).getTime()
        );
    }, [activities]);

    const hasMeaningfulData = (item: Completed) => {
        const columnsToCheck = ["activity_reference_number", "referenceid", "quotation_number", "quotation_amount"];
        return columnsToCheck.some((col) => {
            const val = (item as any)[col];
            if (val === null || val === undefined) return false;
            if (typeof val === "string") return val.trim() !== "";
            if (typeof val === "number") return !isNaN(val);
            return Boolean(val);
        });
    };

    const filteredActivities = useMemo(() => {
        const search = searchTerm.toLowerCase();
        return sortedActivities
            .filter((item) => {
                if (!search) return true;
                return (
                    item.company_name?.toLowerCase().includes(search) ||
                    item.quotation_number?.toLowerCase().includes(search) ||
                    item.activity_reference_number?.toLowerCase().includes(search) ||
                    item.tsm_approved_status?.toLowerCase().includes(search)
                );
            })
            .filter((item) => {
                if (filterStatus !== "all" && item.status !== filterStatus) return false;
                if (item.type_activity !== "Quotation Preparation") return false;
                return true;
            })
            .filter((item) => {
                if (!dateCreatedFilterRange || (!dateCreatedFilterRange.from && !dateCreatedFilterRange.to)) return true;
                const updated = item.date_updated ? new Date(item.date_updated) : new Date(item.date_created);
                const from = dateCreatedFilterRange.from ? new Date(dateCreatedFilterRange.from) : null;
                const to = dateCreatedFilterRange.to ? new Date(dateCreatedFilterRange.to) : null;
                if (from && updated < from) return false;
                if (to && updated > to) return false;
                return true;
            })
            .filter(hasMeaningfulData);
    }, [sortedActivities, searchTerm, filterStatus, dateCreatedFilterRange]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, dateCreatedFilterRange]);

    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
    const paginatedActivities = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredActivities.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredActivities, currentPage]);

    const statusOptions = useMemo(() => {
        const setStatus = new Set<string>();
        sortedActivities.forEach((a) => { if (a.status) setStatus.add(a.status); });
        return Array.from(setStatus).sort();
    }, [sortedActivities]);

    const typeActivityOptions = useMemo(() => {
        const setType = new Set<string>();
        sortedActivities.forEach((a) => { if (a.type_activity) setType.add(a.type_activity); });
        return Array.from(setType).sort();
    }, [sortedActivities]);

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedActivities.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedActivities.map(item => item.id)));
        }
    };

    const onConfirmRemove = async () => {
        try {
            const res = await fetch("/api/act-delete-history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), remarks: removeRemarks }),
            });
            if (!res.ok) throw new Error("Failed to delete selected activities");
            setDeleteDialogOpen(false);
            setSelectedIds(new Set());
            setRemoveRemarks("");
            fetchActivities();
        } catch (error) { console.error(error); }
    };

    const displayValue = (v: any) => v === null || v === undefined || String(v).trim() === "" ? "" : String(v);

    function formatDuration(start?: string, end?: string) {
        if (!start || !end) return "-";
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "-";
        let diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
        if (diff < 0) diff = 0;
        const hours = Math.floor(diff / 3600);
        diff %= 3600;
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        const parts: string[] = [];
        if (hours > 0) parts.push(`${hours} hr${hours !== 1 ? "s" : ""}`);
        if (minutes > 0) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sec${seconds !== 1 ? "s" : ""}`);
        return parts.join(" ");
    }

    return (
        <>
            {/* Header: Search and Filters */}
            <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="relative w-full md:max-w-md">
                    <Input
                        type="text"
                        placeholder="Search company, reference ID, status..."
                        className="input input-bordered input-sm w-full rounded-none pl-3"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-3 top-2 h-4 w-4 animate-spin text-gray-400" />}
                </div>

                {/* Sidebar/Filter Toggle Group */}
                <div className="flex items-center w-full md:w-auto justify-between md:justify-end space-x-2">
                    <TaskListDialog
                        filterStatus={filterStatus}
                        filterTypeActivity={filterTypeActivity}
                        setFilterStatus={setFilterStatus}
                        setFilterTypeActivity={setFilterTypeActivity}
                        statusOptions={statusOptions}
                        typeActivityOptions={typeActivityOptions}
                    />

                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialogOpen(true)}
                            className="rounded-none px-4"
                        >
                            Delete Selected ({selectedIds.size})
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-4 text-xs">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertTitle>Network Error</AlertTitle>
                    <AlertDescription>{error || "Please check your internet connection or try again later."}</AlertDescription>
                </Alert>
            )}

            {!loading && filteredActivities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 border border-dashed border-gray-200">
                    <SearchX className="h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No matching quotations found.</p>
                </div>
            )}

            {filteredActivities.length > 0 && (
                <div className="mb-2 text-xs font-bold flex justify-between items-center px-1">
                    <span>Total Records: {filteredActivities.length}</span>
                    <span className="text-gray-500 font-normal italic">Page {currentPage} of {totalPages || 1}</span>
                </div>
            )}

            {/* Mobile View: Cards */}
            <div className="block md:hidden space-y-4">
                {paginatedActivities.map((item) => (
                    <div key={item.id} className="border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    className="w-5 h-5 rounded"
                                    checked={selectedIds.has(item.id)}
                                    onCheckedChange={() => toggleSelect(item.id)}
                                />
                                <div>
                                    <p className="font-bold text-sm leading-tight">{item.company_name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase mt-0.5">{item.quotation_number}</p>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setEditItem(item); setEditOpen(true); }}>
                                        <PenIcon className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 text-[11px] border-t border-b py-2">
                            <div className="flex items-center gap-1.5 text-gray-600">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH")}
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-600">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDuration(item.start_date, item.end_date)}
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-600 col-span-2">
                                <Phone className="w-3.5 h-3.5" />
                                {displayValue(item.contact_number) || "No Contact"}
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-blue-700 col-span-2">
                                <PhilippinePeso className="w-3.5 h-3.5" />
                                ₱{item.quotation_amount ? item.quotation_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                            </div>
                        </div>

                        <div className="text-[10px] flex items-center justify-between">
                            <div className={`inline-block px-2 py-0.5 rounded-xs font-bold ${
                                item.tsm_approved_status === "Approved" ? "bg-green-100 text-green-700" :
                                item.tsm_approved_status === "Pending" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                            }`}>
                                {item.tsm_approved_status}
                            </div>
                            {item.tsm_approval_date && <p className="text-gray-500">TSM: {new Date(item.tsm_approval_date).toLocaleDateString()}</p>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop View: Table */}
            <div className={`hidden md:block overflow-auto custom-scrollbar ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                <Table className="text-xs border">
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox 
                                    className="w-5 h-5" 
                                    checked={selectedIds.size > 0 && selectedIds.size === paginatedActivities.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[60px] text-center">Tools</TableHead>
                            <TableHead>Date Created</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Approval Timeline</TableHead>
                            <TableHead>Contact #</TableHead>
                            <TableHead>Quotation #</TableHead>
                            <TableHead>Quotation Amount</TableHead>
                            <TableHead className="text-center">Source</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedActivities.map((item) => (
                            <TableRow key={item.id} className="hover:bg-gray-50/50">
                                <TableCell>
                                    <Checkbox
                                        className="w-5 h-5 rounded cursor-pointer"
                                        checked={selectedIds.has(item.id)}
                                        onCheckedChange={() => toggleSelect(item.id)}
                                    />
                                </TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="rounded-none flex items-center gap-1 text-[10px] h-7 px-2">
                                                Actions <MoreVertical className="w-3 h-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-none text-xs">
                                            <DropdownMenuItem onClick={() => { setEditItem(item); setEditOpen(true); }} className="cursor-pointer">
                                                <PenIcon className="w-3.5 h-3.5 mr-2" /> Edit
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                                <TableCell>{new Date(item.date_updated ?? item.date_created).toLocaleDateString("en-PH")}</TableCell>
                                <TableCell className="whitespace-nowrap font-mono text-[10px]">{formatDuration(item.start_date, item.end_date)}</TableCell>
                                <TableCell className="font-semibold max-w-[150px] truncate">{item.company_name}</TableCell>
                                <TableCell className="p-2 text-center">
                                    <span className={`inline-flex items-center rounded-xs px-2 py-0.5 text-[10px] font-bold uppercase ${
                                        item.tsm_approved_status === "Approved" ? "bg-green-100 text-green-700" :
                                        item.tsm_approved_status === "Pending" ? "bg-orange-100 text-orange-700" :
                                        item.tsm_approved_status === "Decline" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                                    }`}>
                                        {item.tsm_approved_status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-[10px] leading-tight min-w-[180px]">
                                    {item.tsm_approval_date && (
                                        <div className="mb-1 text-green-600">TSM: {new Date(item.tsm_approval_date).toLocaleDateString()}</div>
                                    )}
                                    {item.manager_approval_date && (
                                        <div className="text-blue-600">Head: {new Date(item.manager_approval_date).toLocaleDateString()}</div>
                                    )}
                                    {!item.tsm_approval_date && !item.manager_approval_date && <span className="text-gray-400">No data</span>}
                                </TableCell>
                                <TableCell>{displayValue(item.contact_number)}</TableCell>
                                <TableCell className="uppercase font-mono">{displayValue(item.quotation_number)}</TableCell>
                                <TableCell className="font-bold">
                                    ₱{item.quotation_amount ? item.quotation_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${
                                        item.quotation_type === "Ecoshift Corporation" ? "border-green-200 text-green-700 bg-green-50" : "border-rose-200 text-rose-700 bg-rose-50"
                                    }`}>
                                        {displayValue(item.quotation_type)}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col md:flex-row items-center justify-between py-4 pb-20 md:pb-4 gap-4">
                    <p className="text-[10px] text-gray-500">Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredActivities.length)} of {filteredActivities.length} entries</p>
                    <div className="flex items-center space-x-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="rounded-none h-8 px-2"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <div className="flex items-center">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) pageNum = currentPage - 3 + i;
                                if (pageNum > totalPages) return null;
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setCurrentPage(pageNum)}
                                        className="rounded-none h-8 w-8 p-0 text-xs"
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="rounded-none h-8 px-2"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Dialogs */}
            {editOpen && editItem && (
                <TaskListEditDialog
                    item={editItem}
                    onClose={() => { setEditOpen(false); setEditItem(null); }}
                    onSave={() => { fetchActivities(); setEditOpen(false); setEditItem(null); }}
                    firstname={firstname}
                    lastname={lastname}
                    email={email}
                    contact={contact}
                    tsmname={tsmname}
                    managername={managername}
                    company={{
                        company_name: editItem.company_name,
                        contact_number: editItem.contact_number,
                        email_address: editItem.email_address,
                        address: editItem.address,
                        contact_person: editItem.contact_person,
                    }}
                    vatType={editItem.vat_type}
                    deliveryFee={editItem.delivery_fee}
                    agentSignature={editItem.agent_signature}
                    agentContactNumber={editItem.agent_contact_number}
                    agentEmailAddress={editItem.agent_email_address}
                    TsmSignature={editItem.tsm_signature}
                    TsmEmailAddress={editItem.tsm_email_address}
                    TsmContactNumber={editItem.tsm_contact_number}
                    ManagerSignature={editItem.manager_signature}
                    ManagerContactNumber={editItem.manager_contact_number}
                    ManagerEmailAddress={editItem.manager_email_address}
                    ApprovedStatus={editItem.tsm_approved_status}
                />
            )}

            <AccountsActiveDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                removeRemarks={removeRemarks}
                setRemoveRemarks={setRemoveRemarks}
                onConfirmRemove={onConfirmRemove}
            />
        </>
    );
};